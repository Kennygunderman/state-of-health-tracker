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
  // stamps every sectioned row, repartitionGroceryList stamps a row on its way into the checked card, and
  // retainKnownAisles carries that stamp onto each new answer — which is what makes it outlive the refetch
  // that returns the ticked row bare, so a row the shopper ticks and unticks returns to its own aisle instead
  // of the catch-all. Never sent to the server, which owns the grouping and re-files every row it sections.
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
// It is the last resort of the single-row toggle, where the alternative is the one row the shopper just
// touched leaving the list; the uncheck-all write instead declines a row it knows no aisle for, because a
// whole list re-filed under one heading is a claim about the store, not a row in transit.
const UNFILED_AISLE: GroceryCategory = 'pantry_other'

export type GroceryRowUpdate = (item: GroceryItem) => GroceryItem

/**
 * Carries the aisle identity the client has already learned onto a freshly fetched list.
 *
 * The answer states `category` per section and holds the checked rows out of the sections (0.5.2), so
 * convertGroceryList can stamp the sectioned rows and nothing else: a row that arrives already checked has no
 * aisle. That is true of every fetch, not just the first — the fetch that follows the shopper ticking a row
 * returns it as a bare checked row, so the stamp repartitionGroceryList left on it would be lost and a
 * Produce row would have no aisle to return to when the checks are cleared. Stamping the answer from what the
 * cache already knows is what keeps that identity across refetches.
 *
 * The new answer wins wherever it speaks: a row it returns inside a section has just been re-filed by the
 * server, so only a checked row carrying no `category` is stamped. The previous list's sections are read first
 * because that aisle is the server's own statement; its checked rows are read second, for the stamp this
 * function or repartitionGroceryList left there. Rows are matched by `id` — the row identity the server keys
 * its own writes on — so a re-aggregated list cannot inherit another row's aisle.
 *
 * Neither argument nor any array or row inside them is mutated, and `next` itself is returned when no row
 * needed stamping, so a caller may compare identity to tell that nothing was retained.
 */
export function retainKnownAisles(next: GroceryList, previous: GroceryList | undefined): GroceryList {
  if (previous === undefined) {
    return next
  }

  const knownAisles = new Map<string, GroceryCategory>()

  previous.sections.forEach(section => {
    section.items.forEach(item => {
      knownAisles.set(item.id, section.category)
    })
  })

  previous.checkedItems.forEach(item => {
    if (item.category !== undefined && !knownAisles.has(item.id)) {
      knownAisles.set(item.id, item.category)
    }
  })

  let hasStamped = false

  const checkedItems = next.checkedItems.map(item => {
    const retained = item.category === undefined ? knownAisles.get(item.id) : undefined

    if (retained === undefined) {
      return item
    }

    hasStamped = true

    return {...item, category: retained}
  })

  return hasStamped ? {...next, checkedItems} : next
}

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
