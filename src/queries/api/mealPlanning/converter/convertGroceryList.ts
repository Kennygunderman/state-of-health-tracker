import {GroceryBannerCode, GroceryCategory, GroceryItem, GroceryList} from '@data/models/GroceryList'
import {GroceryItemResponse, GroceryListResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_CATEGORIES = [
  'produce',
  'protein',
  'dairy_alternatives',
  'grains_bread',
  'pantry_other'
] as const satisfies readonly GroceryCategory[]

const KNOWN_BANNER_CODES = ['updated_after_swap', 'amount_increased'] as const satisfies readonly GroceryBannerCode[]

// An unknown aisle lands in the catch-all that already closes the list by design, so it neither disappears
// from the list nor masquerades as produce.
function resolveGroceryCategory(category: string): GroceryCategory {
  return (KNOWN_CATEGORIES as readonly string[]).includes(category) ? (category as GroceryCategory) : 'pantry_other'
}

// displayText and the flag amounts are rendered by the server, which owns the unit family, the rounding and the
// pluralisation, so they are passed through verbatim rather than re-derived from quantityGrams.
export function convertGroceryItem(data: io.TypeOf<typeof GroceryItemResponse>): GroceryItem {
  return {
    id: data.id,
    catalogFoodId: data.catalogFoodId,
    foodState: data.foodState,
    name: data.name,
    quantityGrams: data.quantityGrams,
    displayText: data.displayText,
    isChecked: data.isChecked,
    flag: data.flag
      ? {
          previousDisplayText: data.flag.previousDisplayText,
          newDisplayText: data.flag.newDisplayText,
          deltaDisplayText: data.flag.deltaDisplayText,
          flaggedAt: data.flag.flaggedAt
        }
      : null
  }
}

export function convertGroceryList(data: io.TypeOf<typeof GroceryListResponse>): GroceryList {
  return {
    planId: data.planId,
    planRevision: data.planRevision,
    startDate: data.startDate,
    endDate: data.endDate,
    totalCount: data.totalCount,
    checkedCount: data.checkedCount,
    // An unknown code has no copy to render, so the whole banner is dropped rather than shown blank.
    banner:
      data.banner && (KNOWN_BANNER_CODES as readonly string[]).includes(data.banner.code)
        ? {
            code: data.banner.code as GroceryBannerCode,
            mealSlot: data.banner.mealSlot,
            itemNames: data.banner.itemNames
          }
        : null,
    sections: data.sections.map(section => ({
      category: resolveGroceryCategory(section.category),
      items: section.items.map(convertGroceryItem)
    })),
    checkedItems: data.checkedItems.map(convertGroceryItem)
  }
}
