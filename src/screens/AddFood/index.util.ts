import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood, CatalogNutritionBasis} from '@data/models/CatalogFood'
import {CatalogSourcedFood, FoodSourceEnum, PersonalFood} from '@data/models/Food'
import {SourcedNutritionProvenance} from '@data/models/NutritionProvenance'
import {CatalogSearchState} from '@utility/CatalogSearchStateUtility'

import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

// '1g P · 50g C · 3g F'
export const formatMacroSummary = (protein: number, carbs: number, fat: number): string =>
  `${Math.round(protein)}g P · ${Math.round(carbs)}g C · ${Math.round(fat)}g F`

// Branded search results are catalog rows, not library foods — shape one into a
// Food so Food Detail can treat both paths identically. The branded serving
// text rides along as the serving unit of a single serving.
export const mapBrandedFoodToFood = (brandedFood: BrandedFood): PersonalFood => ({
  id: brandedFood.id,
  name: brandedFood.name,
  servingAmount: 1,
  servingUnit: brandedFood.servingText,
  calories: brandedFood.calories,
  protein: brandedFood.protein,
  carbs: brandedFood.carbs,
  fat: brandedFood.fat,
  brand: brandedFood.brand,
  source: FoodSourceEnum.BRANDED
})

export interface CatalogServingPresentation {
  servingAmount: number
  servingUnit: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
}

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0

// The unit the stated macros are measured in when they cannot be projected. null rather than 'serving' so
// formatServingText pluralises it ("2 servings").
const STATED_BASIS_UNITS: Record<CatalogNutritionBasis, string | null> = {
  per_100g: 'g',
  per_100ml: 'ml',
  per_serving: null
}

// Grams the stated macros describe, or null when they cannot be turned into grams at all: a per_100ml food
// converts through density_g_per_ml, which the AAP 0.5.2 response does not carry.
const statedBasisGrams = (catalogFood: CatalogFood): number | null => {
  switch (catalogFood.nutritionBasis) {
    case 'per_100g':
      return catalogFood.basisAmount
    case 'per_serving':
      return catalogFood.basisAmount * catalogFood.defaultPortion.gramWeight
    case 'per_100ml':
      return null
  }
}

const statedBasisPresentation = (catalogFood: CatalogFood): CatalogServingPresentation => ({
  servingAmount: catalogFood.basisAmount,
  servingUnit: STATED_BASIS_UNITS[catalogFood.nutritionBasis],
  calories: Math.round(catalogFood.calories),
  protein: Math.round(catalogFood.protein),
  carbs: Math.round(catalogFood.carbs),
  fat: Math.round(catalogFood.fat)
})

/**
 * The serving a catalog row is shown at, and the macros of that serving.
 *
 * The response states its macros per basisAmount of nutritionBasis, so they are scaled onto the default
 * portion by gramWeight / basisGrams and rounded ONCE — the server's own expression for the snapshot it
 * stores when this food is logged (0.7.3 rounds once), so the pre-log card equals the diary row it produces
 * to the integer.
 *
 * A volume basis is not projectable: it needs a density no response carries, and assuming 1 g/ml would
 * fabricate nutrition. A conformant server never sends one — it restates every food on the mass basis — so
 * that case, and a basis mass that is not a usable positive number, present the food on its own stated basis
 * instead, where the numbers shown still describe the serving shown.
 */
export const catalogServingPresentation = (catalogFood: CatalogFood): CatalogServingPresentation => {
  const basisGrams = statedBasisGrams(catalogFood)
  const {amount, unit, gramWeight} = catalogFood.defaultPortion

  if (basisGrams === null || !isPositiveFinite(basisGrams) || !isPositiveFinite(gramWeight)) {
    return statedBasisPresentation(catalogFood)
  }

  const scale = gramWeight / basisGrams
  const macros = {
    calories: Math.round(catalogFood.calories * scale),
    protein: Math.round(catalogFood.protein * scale),
    carbs: Math.round(catalogFood.carbs * scale),
    fat: Math.round(catalogFood.fat * scale)
  }

  // Finite inputs can still overflow, and an Infinity macro is worse than the food's own stated figures.
  if (Object.values(macros).some(value => !Number.isFinite(value))) {
    return statedBasisPresentation(catalogFood)
  }

  return {servingAmount: amount, servingUnit: unit, ...macros}
}

// Every published catalog food has a default portion — validation quarantines a candidate without one — so
// the serving is that portion for every response the server can state on the mass basis. catalogFoodId and
// the provenance ride along because Food Detail logs a catalog food by id instead of creating one.
// The serving pair and the macros come from catalogServingPresentation together, never from the stated
// per-basis figures directly: those describe basisAmount of the basis, so pairing them with this serving
// pair would show 100 g of nutrition against a 195 g cup.
export const mapCatalogFoodToFood = (catalogFood: CatalogFood): CatalogSourcedFood => ({
  id: catalogFood.id,
  name: catalogFood.name,
  ...catalogServingPresentation(catalogFood),
  brand: null,
  source: FoodSourceEnum.CATALOG,
  catalogFoodId: catalogFood.id,
  nutritionProvenance: catalogFood.nutritionProvenance,
  // Carried verbatim rather than rebuilt from the serving pair: the log request has to name the portion row
  // the macros above were projected from, and the server rejects a description it does not hold.
  catalogServingDescription: catalogFood.defaultPortion.description
})

// A search result is a catalog food when it carries the catalog portion; branded results have a servingText
// string instead. Both reach the same row component, which hands the pressed result back for mapping.
export const isCatalogSearchResult = (result: CatalogFood | BrandedFood): result is CatalogFood =>
  'defaultPortion' in result

export interface CatalogProvenanceBadge {
  label: string
  tone: 'neutral' | 'warning'
}

// Keyed by the sourced union so a new catalog provenance value cannot compile without a badge decision
const CATALOG_PROVENANCE_BADGES: Record<SourcedNutritionProvenance, CatalogProvenanceBadge> = {
  source_backed: {label: CATALOG_PROVENANCE_BADGE_LABELS.source_backed, tone: 'neutral'},
  ingredient_derived: {label: CATALOG_PROVENANCE_BADGE_LABELS.ingredient_derived, tone: 'warning'},
  ai_estimated: {label: CATALOG_PROVENANCE_BADGE_LABELS.ai_estimated, tone: 'warning'}
}

export const catalogProvenanceBadge = (provenance: SourcedNutritionProvenance): CatalogProvenanceBadge =>
  CATALOG_PROVENANCE_BADGES[provenance]

export interface CatalogSkeletonRow {
  primary: number
  secondary: number
}

// Three placeholder rows shaped like a loaded catalog row — a name line and a category line — with uneven
// widths so the block reads as text rather than as a table.
export const CATALOG_SKELETON_ROWS: ReadonlyArray<CatalogSkeletonRow> = Object.freeze([
  Object.freeze({primary: 0.68, secondary: 0.36}),
  Object.freeze({primary: 0.54, secondary: 0.44}),
  Object.freeze({primary: 0.62, secondary: 0.3})
])

// Skeleton takes a numeric width and reads it once at mount to size its shimmer, so a proportional bar has to
// be measured against the filled column rather than given a percentage.
export const catalogSkeletonBarWidth = (barAreaWidth: number, widthProportion: number): number =>
  barAreaWidth > 0 ? Math.round(barAreaWidth * widthProportion) : 0

export type AddFoodSectionKey = 'library' | 'catalog' | 'branded'

export interface AddFoodSectionVisibility {
  showLibrary: boolean
  showCatalog: boolean
  showBranded: boolean
}

/**
 * The section that draws the "New Food" button, which is whichever of the three renders first — so exactly
 * one of them ever draws it: library claims it whenever it renders, catalog only when library is hidden,
 * branded only when both of the sections above it are hidden, and no section claims it when the list is empty
 * of sections entirely.
 */
export const newFoodButtonOwner = ({
  showLibrary,
  showCatalog,
  showBranded
}: AddFoodSectionVisibility): AddFoodSectionKey | null => {
  if (showLibrary) {
    return 'library'
  }

  if (showCatalog) {
    return 'catalog'
  }

  return showBranded ? 'branded' : null
}

/**
 * Whether the catalog section renders for a given verdict. Unlike branded, the section stays mounted for the
 * whole search — its loading, error and no-results answers are each a distinct thing the user is owed — so it
 * renders for every verdict except the two that have nothing to report.
 */
export const isCatalogSectionVisible = (state: CatalogSearchState): boolean => state !== 'hidden' && state !== 'idle'
