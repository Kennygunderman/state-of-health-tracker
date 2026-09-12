import {GroceryBanner, GroceryCategory, GroceryItem, GroceryList, GrocerySection} from '@data/models/GroceryList'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {formatPlanRange} from '@utility/MealPlanDateUtility'

import {
  GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNT_INCREASED_TITLE,
  GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
  GROCERY_CATEGORY_LABELS,
  GROCERY_CHECKED_PROGRESS_TEMPLATE,
  GROCERY_NO_PLAN_EYEBROW,
  GROCERY_UPDATED_AFTER_SWAP_TEMPLATE,
  GROCERY_UPDATED_AFTER_SWAP_TEXT,
  MEAL_SLOT_SENTENCE_LABELS,
  stringWithNamedParameters
} from '@constants/strings'

const AISLE_ORDER: ReadonlyArray<GroceryCategory> = ['produce', 'protein', 'dairy_alternatives', 'grains_bread']

const CLOSING_AISLE: GroceryCategory = 'pantry_other'

const NO_EYEBROW_TEXT = ''

export interface GroceryQueryState {
  isLoading: boolean
  isError: boolean
  data?: GroceryList
}

export type GroceryView =
  | {kind: 'noPlan'}
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'emptyList'; list: GroceryList}
  | {kind: 'list'; list: GroceryList}

export type GroceryRowVariant = 'unchecked' | 'checkedMuted' | 'flagged'

export interface GroceryEyebrow {
  text: string
  tone: 'muted' | 'green'
}

export interface GroceryBannerContent {
  tone: 'success' | 'error'
  glyph: 'tick' | 'warning'
  title?: string
  body: string
}

const isEmptyGroceryList = (list: GroceryList): boolean =>
  list.totalCount === 0 || (list.checkedCount === 0 && list.sections.every(section => section.items.length === 0))

/**
 * The three ways this screen can show nothing are separate states and never interchangeable: no plan is the 14c
 * empty state, a decoded empty list carries its own copy, and a failure is the retry card. Decoded data therefore
 * outranks `isError`, so a failed background refetch never blanks a list the user is already reading.
 */
export function resolveGroceryView(query: GroceryQueryState, planId: string | null): GroceryView {
  if (planId === null) {
    return {kind: 'noPlan'}
  }

  const {data} = query

  if (data !== undefined) {
    return isEmptyGroceryList(data) ? {kind: 'emptyList', list: data} : {kind: 'list', list: data}
  }

  if (query.isError) {
    return {kind: 'error'}
  }

  return {kind: 'loading'}
}

// A decrease has no variant of its own: the server flags increases only, so a checked row whose amount fell
// arrives with `flag === null` and keeps the muted treatment — no sub-line, no pill.
export function groceryRowVariant(item: GroceryItem): GroceryRowVariant {
  if (!item.isChecked) {
    return 'unchecked'
  }

  return item.flag === null ? 'checkedMuted' : 'flagged'
}

export function shouldShowUncheckAll(checkedCount: number): boolean {
  return checkedCount > 0
}

export function groceryEyebrow(view: GroceryView): GroceryEyebrow {
  if (view.kind === 'noPlan') {
    return {text: GROCERY_NO_PLAN_EYEBROW, tone: 'muted'}
  }

  if (view.kind === 'loading' || view.kind === 'error') {
    return {text: NO_EYEBROW_TEXT, tone: 'muted'}
  }

  const {startDate, endDate, checkedCount, totalCount} = view.list

  if (view.kind === 'list' && checkedCount > 0) {
    return {
      text: stringWithNamedParameters(GROCERY_CHECKED_PROGRESS_TEMPLATE, {checked: checkedCount, total: totalCount}),
      tone: 'muted'
    }
  }

  return {text: formatPlanRange(startDate, endDate), tone: 'green'}
}

export function countFlaggedItems(items: GroceryItem[]): number {
  return items.filter(item => item.flag !== null).length
}

export function groceryBanner(banner: GroceryBanner | null, flagCount: number): GroceryBannerContent | null {
  if (banner === null) {
    return null
  }

  if (banner.code === 'updated_after_swap') {
    const slot: string | undefined =
      banner.mealSlot === undefined ? undefined : MEAL_SLOT_SENTENCE_LABELS[banner.mealSlot]

    return {
      tone: 'success',
      glyph: 'tick',
      body:
        slot === undefined
          ? GROCERY_UPDATED_AFTER_SWAP_TEXT
          : stringWithNamedParameters(GROCERY_UPDATED_AFTER_SWAP_TEMPLATE, {slot})
    }
  }

  const [firstItemName] = banner.itemNames ?? []

  // The singular copy names the one item, so an unnamed flag set falls back to the plural rather than an empty name.
  if (flagCount <= 1 && firstItemName !== undefined) {
    return {
      tone: 'error',
      glyph: 'warning',
      title: GROCERY_AMOUNT_INCREASED_TITLE,
      body: stringWithNamedParameters(GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE, {name: firstItemName})
    }
  }

  return {
    tone: 'error',
    glyph: 'warning',
    title: stringWithNamedParameters(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE, {n: flagCount}),
    body: stringWithNamedParameters(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE, {n: flagCount})
  }
}

/**
 * Aisles run in store order and 'Pantry & other' closes the list (37:157), so a category code this version does
 * not know sorts after the named aisles but ahead of that closer. Checked rows belong to the Checked block alone,
 * so they are dropped here whether or not the server pre-filtered them — along with any aisle they empty, which
 * would otherwise render as a bare header.
 */
export function orderGrocerySections(sections: GrocerySection[]): GrocerySection[] {
  const stocked: GrocerySection[] = sections
    .map(section => ({category: section.category, items: section.items.filter(item => !item.isChecked)}))
    .filter(section => section.items.length > 0)

  const namedAisles = AISLE_ORDER.flatMap(category => stocked.filter(section => section.category === category))
  const unknownAisles = stocked.filter(
    section => !AISLE_ORDER.includes(section.category) && section.category !== CLOSING_AISLE
  )
  const closingAisle = stocked.filter(section => section.category === CLOSING_AISLE)

  return [...namedAisles, ...unknownAisles, ...closingAisle]
}

export function groceryCategoryLabel(category: string): string {
  return GROCERY_CATEGORY_LABELS[category] ?? GROCERY_CATEGORY_LABELS[CLOSING_AISLE]
}

// Mirrors ContentColumn's own geometry so a Skeleton placeholder measures the same as the card it stands in for.
export function contentColumnWidth(windowWidth: number): number {
  return Math.min(windowWidth, Sizes.CONTENT_MAX_WIDTH) - Spacing.GUTTER * 2
}
