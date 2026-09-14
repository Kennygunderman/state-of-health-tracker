export type GroceryCategory = 'produce' | 'protein' | 'dairy_alternatives' | 'grains_bread' | 'pantry_other'

export type GroceryBannerCode = 'updated_after_swap' | 'amount_increased'

export interface GroceryItemFlag {
  // previousDisplayText is the last amount the user acknowledged — the quantity shown when they checked
  // the item or last cleared its flag — not the quantity before the most recent change, so repeated
  // swaps keep comparing against what the user actually saw.
  previousDisplayText: string
  newDisplayText: string
  deltaDisplayText: string
  flaggedAt: string
}

export interface GroceryItem {
  id: string
  catalogFoodId: string
  foodState: string
  name: string
  quantityGrams: number
  displayText: string
  isChecked: boolean
  flag: GroceryItemFlag | null
  // The aisle this row belongs to, remembered client-side. Optional because the response carries `category`
  // on a section and not on a row (0.5.2), so a row that arrived already checked has none: convertGroceryList
  // stamps every sectioned row, and repartitionGroceryList stamps a row on its way into the checked card, so
  // a row the shopper ticks and unticks returns to its own aisle instead of the catch-all. Never sent to the
  // server, which owns the grouping and re-files every row on the next fetch.
  category?: GroceryCategory
}

export interface GroceryBanner {
  code: GroceryBannerCode
  mealSlot?: string
  itemNames?: string[]
}

export interface GrocerySection {
  category: GroceryCategory
  items: GroceryItem[]
}

export interface GroceryList {
  planId: string
  planRevision: number
  startDate: string
  endDate: string
  totalCount: number
  checkedCount: number
  banner: GroceryBanner | null
  sections: GrocerySection[]
  checkedItems: GroceryItem[]
}

export interface ToggleGroceryItemPayload {
  isChecked: boolean
}

export interface ToggleGroceryItemResult {
  item: GroceryItem
  checkedCount: number
}

export interface UncheckAllGroceriesResult {
  checkedCount: number
}

// Where a row goes when no aisle is known for it: the catch-all that already closes the list by design
// (37:157) and already takes an unrecognised server aisle in convertGroceryList, so an unfiled row stays on
// the shopper's list under an honest "everything else" heading until the settle refetch names its aisle.
const UNFILED_AISLE: GroceryCategory = 'pantry_other'

export type GroceryRowUpdate = (item: GroceryItem) => GroceryItem

function aisleFor(sections: GrocerySection[], category: GroceryCategory): GrocerySection {
  const existing = sections.find(section => section.category === category)

  if (existing !== undefined) {
    return existing
  }

  const created: GrocerySection = {category, items: []}

  sections.push(created)

  return created
}

/**
 * Applies a per-row change and re-partitions the list, which is what keeps the three members the screen reads
 * in agreement: `sections` hold the unchecked rows, `checkedItems` the checked ones, `checkedCount` the number
 * of checked rows. Flipping a tick without re-filing the row breaks all three at once — the row is left under
 * the "Checked · n" heading while reading as unchecked, and once no aisle row is left behind it, a list with
 * items in it resolves to the empty-list state and the shopper's groceries disappear.
 *
 * A row returns to the aisle it came from: the section it currently sits in, else the `category` stamped on it
 * when it was ticked, else the catch-all above.
 *
 * Order is preserved on both sides. Aisle rows keep their positions and a returning row follows them;
 * still-checked rows keep theirs and a newly ticked row follows them, so nothing the shopper is looking at
 * jumps. An emptied aisle is kept rather than dropped, so a row unticked straight after ticking lands back in
 * its own slot; the screen's section ordering is what hides an empty aisle from the list.
 *
 * Neither the list nor any array or row inside it is mutated, so the caller's snapshot stays a valid rollback
 * value, and an unchanged row keeps its identity.
 */
export function repartitionGroceryList(list: GroceryList, update: GroceryRowUpdate): GroceryList {
  const sections: GrocerySection[] = list.sections.map(section => ({category: section.category, items: []}))
  const stillChecked: GroceryItem[] = []
  const newlyChecked: GroceryItem[] = []

  list.sections.forEach((section, index) => {
    section.items.forEach(row => {
      const item = update(row)

      if (item.isChecked) {
        newlyChecked.push(item.category === undefined ? {...item, category: section.category} : item)

        return
      }

      sections[index].items.push(item)
    })
  })

  list.checkedItems.forEach(row => {
    const item = update(row)

    if (item.isChecked) {
      stillChecked.push(item)

      return
    }

    aisleFor(sections, item.category ?? UNFILED_AISLE).items.push(item)
  })

  const checkedItems: GroceryItem[] = [...stillChecked, ...newlyChecked]

  return {...list, sections, checkedItems, checkedCount: checkedItems.length}
}
