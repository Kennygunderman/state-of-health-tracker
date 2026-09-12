import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood} from '@data/models/CatalogFood'
import {Food, FoodSourceEnum} from '@data/models/Food'
import {SourcedNutritionProvenance} from '@data/models/NutritionProvenance'

import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

// '1g P · 50g C · 3g F'
export const formatMacroSummary = (protein: number, carbs: number, fat: number): string =>
  `${Math.round(protein)}g P · ${Math.round(carbs)}g C · ${Math.round(fat)}g F`

// Branded search results are catalog rows, not library foods — shape one into a
// Food so Food Detail can treat both paths identically. The branded serving
// text rides along as the serving unit of a single serving.
export const mapBrandedFoodToFood = (brandedFood: BrandedFood): Food => ({
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

// Every published catalog food has a default portion — validation quarantines a candidate without
// one — so the portion maps straight onto the serving pair with no fallback. catalogFoodId and the
// provenance ride along because Food Detail logs a catalog food by id instead of creating one.
export const mapCatalogFoodToFood = (catalogFood: CatalogFood): Food => ({
  id: catalogFood.id,
  name: catalogFood.name,
  servingAmount: catalogFood.defaultPortion.amount,
  servingUnit: catalogFood.defaultPortion.unit,
  calories: catalogFood.calories,
  protein: catalogFood.protein,
  carbs: catalogFood.carbs,
  fat: catalogFood.fat,
  brand: null,
  source: FoodSourceEnum.CATALOG,
  catalogFoodId: catalogFood.id,
  nutritionProvenance: catalogFood.nutritionProvenance
})

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
