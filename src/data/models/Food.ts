import {SOURCED_NUTRITION_PROVENANCES, SourcedNutritionProvenance} from './NutritionProvenance'

export enum FoodSourceEnum {
  MANUAL = 'manual',
  LABEL_SCAN = 'label_scan',
  BRANDED = 'branded',
  SEED = 'seed',
  CATALOG = 'catalog'
}

// Every source a client may claim. 'catalog' is excluded because the personal-food endpoints accept only
// manual|label_scan|branded|seed and downgrade anything else to manual: a catalog-sourced food is one the
// server resolved from a catalog_foods row, never one a request asked to be labelled that way.
export type PersonalFoodSource = Exclude<FoodSourceEnum, FoodSourceEnum.CATALOG>

interface FoodFields {
  id: string
  name: string
  servingAmount: number
  servingUnit: string | null
  // Per-serving values.
  calories: number
  protein: number
  carbs: number
  fat: number
  brand: string | null
}

// A published catalog food. The id and the provenance are what make its numbers checkable — the id names the
// row the server will re-derive them from, the provenance says how they were obtained — so the three facts are
// required together and a catalog-labelled food without them cannot be constructed.
export interface CatalogSourcedFood extends FoodFields {
  source: FoodSourceEnum.CATALOG
  catalogFoodId: string
  nutritionProvenance: SourcedNutritionProvenance
  // The stored description of the catalog portion the values above were projected onto, carried verbatim so a
  // log request can name the same portion row the numbers came from. It is never reconstructed from
  // servingAmount/servingUnit: stored descriptions are rarely '<amount> <unit>' ('RACC', 'lemon', '1 cup,
  // halves'), and the server rejects a description it does not hold. Optional because a food restored from
  // persisted navigation state may carry none; absent means the server resolves the default portion itself.
  catalogServingDescription?: string
}

// The user's own food: library, label-scanned, branded copy or seed. The two `never` members are load-bearing
// rather than decorative — they keep food.catalogFoodId and food.nutritionProvenance readable on the union (so
// a call site can narrow on them) while making {source: MANUAL, nutritionProvenance: 'source_backed'} a compile
// error. These macros are client-supplied, so no provenance label is earned.
export interface PersonalFood extends FoodFields {
  source: PersonalFoodSource
  catalogFoodId?: never
  nutritionProvenance?: never
  catalogServingDescription?: never
}

export type Food = CatalogSourcedFood | PersonalFood

export interface CreateFoodPayload {
  name: string
  servingAmount?: number
  servingUnit?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  brand?: string
  source?: PersonalFoodSource
}

export function isCatalogFood(food: Food): food is CatalogSourcedFood {
  return food.source === FoodSourceEnum.CATALOG
}

export function formatServingText(food: Food): string {
  if (!food.servingUnit) {
    return food.servingAmount === 1 ? '1 serving' : `${food.servingAmount} servings`
  }

  return `${food.servingAmount} ${food.servingUnit}`
}

// Derived rather than restated so that adding a FoodSourceEnum member cannot leave this list behind.
const PERSONAL_FOOD_SOURCES: readonly PersonalFoodSource[] = Object.values(FoodSourceEnum).filter(
  (source): source is PersonalFoodSource => source !== FoodSourceEnum.CATALOG
)

const isPersonalFoodSource = (value: unknown): value is PersonalFoodSource =>
  typeof value === 'string' && (PERSONAL_FOOD_SOURCES as readonly string[]).includes(value)

const isSourcedProvenance = (value: unknown): value is SourcedNutritionProvenance =>
  typeof value === 'string' && (SOURCED_NUTRITION_PROVENANCES as readonly string[]).includes(value)

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string'

/**
 * Validates a `food` route param restored from persisted navigation state, returning null for anything that is
 * not a Food.
 *
 * React Navigation rehydrates persisted params from arbitrary JSON, so a restored param is untrusted input
 * rather than the object the pushing screen passed. It fails closed — never a repaired object and never a
 * throw — because the only repairs available are inventing a catalog id or dropping a provenance, and both
 * would make this client the author of a source claim the server never made.
 */
export function parseRouteFood(value: unknown): Food | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    return null
  }

  if (typeof candidate.name !== 'string') {
    return null
  }

  if (!isFiniteNumber(candidate.servingAmount) || !isNullableString(candidate.servingUnit)) {
    return null
  }

  if (
    !isFiniteNumber(candidate.calories) ||
    !isFiniteNumber(candidate.protein) ||
    !isFiniteNumber(candidate.carbs) ||
    !isFiniteNumber(candidate.fat)
  ) {
    return null
  }

  if (!isNullableString(candidate.brand)) {
    return null
  }

  const fields: FoodFields = {
    id: candidate.id,
    name: candidate.name,
    servingAmount: candidate.servingAmount,
    servingUnit: candidate.servingUnit,
    calories: candidate.calories,
    protein: candidate.protein,
    carbs: candidate.carbs,
    fat: candidate.fat,
    brand: candidate.brand
  }

  if (candidate.source === FoodSourceEnum.CATALOG) {
    if (typeof candidate.catalogFoodId !== 'string' || candidate.catalogFoodId.length === 0) {
      return null
    }

    if (!isSourcedProvenance(candidate.nutritionProvenance)) {
      return null
    }

    const servingDescription = candidate.catalogServingDescription

    // Rejected rather than dropped when malformed: a present-but-unusable description is a param this client
    // did not write, and silently continuing without it would log a portion the screen never showed.
    if (servingDescription !== undefined && (typeof servingDescription !== 'string' || servingDescription === '')) {
      return null
    }

    return {
      ...fields,
      source: FoodSourceEnum.CATALOG,
      catalogFoodId: candidate.catalogFoodId,
      nutritionProvenance: candidate.nutritionProvenance,
      ...(servingDescription === undefined ? {} : {catalogServingDescription: servingDescription})
    }
  }

  if (!isPersonalFoodSource(candidate.source)) {
    return null
  }

  // A personal food carrying any catalog member is rejected rather than stripped: the object claims a
  // provenance its source cannot support, so what it describes is unknown.
  if (
    candidate.catalogFoodId !== undefined ||
    candidate.nutritionProvenance !== undefined ||
    candidate.catalogServingDescription !== undefined
  ) {
    return null
  }

  return {...fields, source: candidate.source}
}
