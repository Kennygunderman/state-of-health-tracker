import {GroceryBannerCode, GroceryCategory, GroceryItem, GroceryList, GrocerySection} from '@data/models/GroceryList'
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

/**
 * One section per resolved aisle, in the order the aisles first appear, with a folded aisle's rows appended
 * to the section that claimed its category.
 *
 * Folding is required and not a tidiness. An aisle code this version does not know is filed under
 * 'pantry_other' above, and 'pantry_other' is also a code the response sends in its own right, so a response
 * carrying both yields two sections claiming that one category. The screen keys its list blocks by category
 * (`buildGroceryViewModel`), so leaving them separate hands the `FlatList` two cells under a single key: a
 * React duplicate-key error, two identical 'Pantry & other' headings, and recycled cells landing under the
 * wrong one. AAP 0.7.5 releases the backend ahead of the client, so a client meeting an aisle code newer than
 * itself is the expected case rather than a hypothetical one. Folding keeps every row, under the single
 * heading the catch-all is meant to be.
 *
 * Each row is stamped with the category it ends up filed under, which is what lets an optimistic uncheck
 * return it to the aisle the shopper saw it in.
 */
function convertGrocerySections(sections: io.TypeOf<typeof GroceryListResponse>['sections']): GrocerySection[] {
  const merged: GrocerySection[] = []

  sections.forEach(section => {
    const category = resolveGroceryCategory(section.category)
    const items = section.items.map(item => ({...convertGroceryItem(item), category}))
    const claimed = merged.find(candidate => candidate.category === category)

    if (claimed === undefined) {
      merged.push({category, items})

      return
    }

    claimed.items.push(...items)
  })

  return merged
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
    // Each sectioned row carries its aisle so an optimistic uncheck can return it there. The response states
    // the aisle per section and not per row, and it holds back the checked rows, so checkedItems rows get
    // none: they are re-filed by the next fetch, or by the aisle the row was stamped with when it was ticked.
    sections: convertGrocerySections(data.sections),
    checkedItems: data.checkedItems.map(convertGroceryItem)
  }
}
