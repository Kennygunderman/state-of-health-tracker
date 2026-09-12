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
