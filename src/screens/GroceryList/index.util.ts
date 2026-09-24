import {GroceryBanner, GroceryCategory, GroceryItem, GroceryList, GrocerySection} from '@data/models/GroceryList'
import {CurrentMealPlans} from '@data/models/MealPlan'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {isPlanStateError, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {formatPlanRange} from '@utility/MealPlanDateUtility'
import {lookupLabel} from '@utility/TextUtility'

import {
  GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNT_INCREASED_BODY_UNNAMED,
  GROCERY_AMOUNT_INCREASED_TITLE,
  GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
  GROCERY_CATEGORY_LABELS,
  GROCERY_CHECKED_HEADER_TEMPLATE,
  GROCERY_CHECKED_PROGRESS_TEMPLATE,
  GROCERY_NO_PLAN_EYEBROW,
  GROCERY_UPDATED_AFTER_SWAP_TEMPLATE,
  GROCERY_UPDATED_AFTER_SWAP_TEXT,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_SLOT_SENTENCE_LABELS,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

const AISLE_ORDER: ReadonlyArray<GroceryCategory> = ['produce', 'protein', 'dairy_alternatives', 'grains_bread']

const CLOSING_AISLE: GroceryCategory = 'pantry_other'

const NO_EYEBROW_TEXT = ''

// Keys are namespaced so the Checked block can never collide with a category code the server adds later.
const CATEGORY_BLOCK_KEY_PREFIX = 'category:'
const CHECKED_BLOCK_KEY = 'checked'

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

/**
 * Which plan this screen is shopping, before its list has been asked for.
 *
 * The four answers are separate because only one of them is 14c: 'noPlan' is a plan the server said does not
 * exist, 'unavailable' is a lookup that failed and therefore said nothing, and 'resolving' is a lookup still
 * in flight. AAP 0.2.5 reserves the drawn empty state for decoded absence, so a failed `/plans/current` may
 * never present itself as "Nothing to shop for yet".
 */
export type GroceryPlanScope =
  | {kind: 'plan'; planId: string}
  | {kind: 'resolving'}
  | {kind: 'unavailable'}
  | {kind: 'noPlan'}

/**
 * The current-plan read as this derivation needs to see it. `isLoading` is deliberately absent: nothing
 * decoded and nothing refused is 'resolving' whether the request is in flight or paused offline, so a
 * loading flag would add a member no branch could read.
 */
export interface GroceryCurrentPlanState {
  isError: boolean
  data?: CurrentMealPlans
}

export interface GroceryPlanScopeInputs {
  routePlanId: string | null
  currentPlan: GroceryCurrentPlanState
}

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

/**
 * One list row per section, not per item: 37:338 draws a single card behind a whole aisle, and that card is the
 * screen's own style rather than the row's, so the block is the unit the list can lay out and recycle. Rows
 * inside it size to content, which is what AAP 0.7.4's text-scaling policy asks of this list.
 */
export type GroceryBlock =
  | {kind: 'category'; key: string; label: string; isFirst: boolean; items: GroceryItem[]}
  | {kind: 'checked'; key: string; title: string; items: GroceryItem[]}

/**
 * Everything frames 14 / 14b draw from one decoded list: the ordered blocks, the banner above them and whether
 * the "Uncheck all" action has anything to clear. Derived once per list rather than per render, because each
 * optimistic toggle re-renders this screen three times (pending, cache write, settle) and the aisle ordering,
 * the checked-row ordering and the flag scan are whole-list work every one of those would otherwise repeat.
 */
export interface GroceryViewModel {
  blocks: readonly GroceryBlock[]
  banner: GroceryBannerContent | null
  showsUncheckAll: boolean
  flagCount: number
}

const NO_BLOCKS: readonly GroceryBlock[] = Object.freeze([])

// What the header and the list render while no list is decoded (loading, error, no plan, empty plan). Held as a
// constant so those states allocate nothing and keep a stable identity across renders.
export const EMPTY_GROCERY_VIEW_MODEL: GroceryViewModel = Object.freeze({
  blocks: NO_BLOCKS,
  banner: null,
  showsUncheckAll: false,
  flagCount: 0
})

const holdsNoRows = (list: GroceryList): boolean =>
  list.checkedItems.length === 0 && list.sections.every(section => section.items.length === 0)

// The server's count is the authority on emptiness and the rows are the corroboration, so both must agree:
// a plan that needs no ingredients reports zero and sends none. Requiring both is what stops a list that
// holds groceries from ever claiming to hold none — the count alone would trust a response that contradicts
// its own rows, and the rows alone would call an optimistic write mid-flight an empty plan. A non-zero count
// with no rows to show is left as a list, which renders as its own header with nothing under it rather than
// as a false claim about the plan.
const isEmptyGroceryList = (list: GroceryList): boolean => list.totalCount === 0 && holdsNoRows(list)

/**
 * Which plan the screen is shopping, in one place so no branch can read the current-plan query's fields when
 * they do not apply.
 *
 * The precedence is load-bearing, in this order:
 * - A route plan id wins outright (`GROCERY_LIST` takes `{planId}`, 0.7.4). The current-plan query is disabled
 *   in that case, so its own fields describe nothing about this screen and must not be consulted.
 * - Else a cached plan wins even over a failed read, and it is `current ?? upcoming` — the selection AAP 0.7.4
 *   gives an unset plan id, so a user whose only plan starts next week shops that plan instead of being told
 *   there is nothing to shop. `mealPlanCurrent` is the one persisted query (0.4.1), so an offline session keeps
 *   shopping the plan it has rather than losing it to the refetch.
 * - Else a decoded answer holding neither plan is genuine absence — the only route to 14c.
 * - Else a failed lookup is 'unavailable' (the inline retry card) and anything remaining is still resolving.
 */
export function resolveGroceryPlanScope(inputs: GroceryPlanScopeInputs): GroceryPlanScope {
  const {routePlanId, currentPlan} = inputs

  if (routePlanId !== null) {
    return {kind: 'plan', planId: routePlanId}
  }

  const shoppablePlanId = currentPlan.data?.current?.id ?? currentPlan.data?.upcoming?.id ?? null

  if (shoppablePlanId !== null) {
    return {kind: 'plan', planId: shoppablePlanId}
  }

  if (currentPlan.data !== undefined) {
    return {kind: 'noPlan'}
  }

  return currentPlan.isError ? {kind: 'unavailable'} : {kind: 'resolving'}
}

/**
 * The three ways this screen can show nothing are separate states and never interchangeable: no plan is the 14c
 * empty state, a decoded empty list carries its own copy, and a failure is the retry card. Decoded data therefore
 * outranks `isError`, so a failed background refetch never blanks a list the user is already reading.
 *
 * The scope answers first, because a list can only be read once a plan is known: a current-plan lookup that is
 * still in flight is the skeleton and one that failed is the retry card, and neither may borrow 14c's copy
 * (AAP 0.2.5 — the empty states belong to decoded absence and to a decoded empty list).
 */
export function resolveGroceryView(query: GroceryQueryState, scope: GroceryPlanScope): GroceryView {
  if (scope.kind === 'noPlan') {
    return {kind: 'noPlan'}
  }

  if (scope.kind === 'unavailable') {
    return {kind: 'error'}
  }

  if (scope.kind === 'resolving') {
    return {kind: 'loading'}
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

/**
 * Whether a failure says the plan this screen was opened against is not the plan the server will answer for —
 * a confirmed `stale_plan` or `plan_not_active` (0.5.2). One predicate serves both paths, because the two
 * codes mean the same thing about a refused write and about a failed read (0.2.5).
 *
 * Confirmed-ness is load-bearing and deliberately not dropped: a 5xx whose body merely echoes `stale_plan` is
 * an unknown outcome, and an outcome nothing described earns a retry rather than the code's own copy.
 */
export function isGroceryPlanStateRefusal(error: unknown): boolean {
  if (error === null || error === undefined || isUnknownOutcome(error)) {
    return false
  }

  return isPlanStateError(error)
}

export interface GroceryWriteFailure {
  toast: string
  refetchCurrentPlan: boolean
  unpinStalePlan: boolean
}

/**
 * What one refused grocery write tells the user, whether the plan itself must be re-read, and whether this
 * screen may keep shopping the plan its route names.
 *
 * Both writes are optimistic and both roll themselves back in their mutation factories (0.7.2), so nothing
 * here undoes anything. A confirmed plan-state refusal earns three things: the stale-plan copy, a
 * `mealPlanCurrent` re-read (0.2.5) and `unpinStalePlan` — because the refusal is about the plan and not about
 * the row, so every other row on this list would be refused in exactly the same way. The re-read on its own
 * would change nothing while the route still names the refused plan, since `resolveGroceryPlanScope` honours
 * that id outright; dropping the pin is what lets the refreshed answer decide, which is how the replacement
 * plan's list (0.5.1's `replacementPlanId`) — or, when no plan remains, 14c — takes this screen over instead of
 * the shopper ticking boxes that can only fail. Every other rejection keeps the generic toast and leaves the
 * list exactly where it is.
 */
export function classifyGroceryWriteFailure(error: unknown): GroceryWriteFailure {
  const isPlanStateRefusal = isGroceryPlanStateRefusal(error)

  return {
    toast: isPlanStateRefusal ? MEAL_PLAN_STALE_PLAN_TOAST : TOAST_GENERIC_ERROR,
    refetchCurrentPlan: isPlanStateRefusal,
    unpinStalePlan: isPlanStateRefusal
  }
}

export interface GroceryReadRecovery {
  toast: string | null
  refetchCurrentPlan: boolean
  isPlanStateFailure: boolean
  unpinStalePlan: boolean
}

export interface GroceryReadRecoveryInputs {
  error: unknown
  hasAnnounced: boolean
}

/**
 * The recovery a failed grocery-list read earns. A decoded plan-state code gets the stale-plan toast, a
 * `mealPlanCurrent` re-read and the same dropped pin a refused write gets (0.2.5): the plan this screen was
 * opened for will not answer for its list, so retrying that read cannot succeed and the refreshed current-plan
 * answer is the only thing that can say what this screen should be shopping instead. A network or undecodable
 * failure is left to the inline retry card, which is the only failure a second attempt of the same read could
 * resolve.
 *
 * `hasAnnounced` is the caller's own record that this failure was already reported: the list query's identity
 * changes with the plan id and with every settle invalidation, so an unguarded classification would raise the
 * same toast again for a failure the user has already been told about.
 */
export function groceryReadRecovery(inputs: GroceryReadRecoveryInputs): GroceryReadRecovery {
  const isPlanStateFailure = isGroceryPlanStateRefusal(inputs.error)

  if (!isPlanStateFailure || inputs.hasAnnounced) {
    return {toast: null, refetchCurrentPlan: false, isPlanStateFailure, unpinStalePlan: false}
  }

  return {toast: MEAL_PLAN_STALE_PLAN_TOAST, refetchCurrentPlan: true, isPlanStateFailure, unpinStalePlan: true}
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

  // The tone tracks whether a plan is active, never which string is shown: 14b's counter (37:191) carries the same
  // accent as 14's range (37:35), and muted belongs to the no-plan state alone (37:372).
  if (view.kind === 'list' && checkedCount > 0) {
    return {
      text: stringWithNamedParameters(GROCERY_CHECKED_PROGRESS_TEMPLATE, {checked: checkedCount, total: totalCount}),
      tone: 'green'
    }
  }

  return {text: formatPlanRange(startDate, endDate), tone: 'green'}
}

/**
 * The names of the rows the Checked card is drawing as flagged, in the order it draws them.
 *
 * Filtered through `groceryRowVariant` rather than on `flag !== null`, so this is exactly the set of rows
 * that render the flagged treatment: a row carrying a flag but no tick renders as a plain aisle row
 * (37:54) and may neither be counted nor named. `orderCheckedItems` hoists the flagged rows and preserves
 * their relative order, so reading `checkedItems` in its own order already yields the rendered order.
 *
 * Names come back exactly as the rows hold them, blanks included: the length has to equal the number of
 * flagged rows on screen even when one of them has no name to state.
 */
export function flaggedItemNames(items: GroceryItem[]): string[] {
  return items.filter(item => groceryRowVariant(item) === 'flagged').map(item => item.name)
}

/**
 * The banner above the list, derived from the response's code and from the flagged rows rendered beneath it.
 *
 * Those rows are the naming authority, never `banner.itemNames`. That array is the server's snapshot at
 * response time, and both optimistic writers clear a row's flag without revising it — a toggle sets
 * `flag: null` and "Uncheck all" clears every row — so from the write until the settle refetch lands, the
 * response's names describe rows that are no longer flagged and may no longer be checked at all. Deriving
 * from the rows keeps the banner's claim and the Checked card it points at in agreement at every moment,
 * mid-flight included, instead of only once a refetch has landed. It is also why no fallback to
 * `itemNames` exists: reading them when no row is flagged is precisely the claim that would be false.
 *
 * Three consequences, in the order the branches take them:
 * - No flagged row survives, so the increase banner is dropped entirely. "flagged below ... stays checked"
 *   has nothing left to point at once the last flag is cleared (0.7.3 — toggling a row clears its flag),
 *   and the Checked block it refers to may itself be gone. `updated_after_swap` is untouched by this: it
 *   reports that the swap rebuilt the list, which stays true however the flags then move.
 * - Grammar follows the count alone. One flag is singular whether or not its row can be named, so an
 *   unnamed one states the same fact without a name rather than borrowing the plural's "1 amounts went up".
 * - A named singular names a row that is still flagged.
 */
export function groceryBanner(
  banner: GroceryBanner | null,
  flaggedNames: readonly string[]
): GroceryBannerContent | null {
  if (banner === null) {
    return null
  }

  if (banner.code === 'updated_after_swap') {
    const slot: string | undefined =
      banner.mealSlot === undefined ? undefined : lookupLabel(MEAL_SLOT_SENTENCE_LABELS, banner.mealSlot)

    return {
      tone: 'success',
      glyph: 'tick',
      body:
        slot === undefined
          ? GROCERY_UPDATED_AFTER_SWAP_TEXT
          : stringWithNamedParameters(GROCERY_UPDATED_AFTER_SWAP_TEMPLATE, {slot})
    }
  }

  if (flaggedNames.length === 0) {
    return null
  }

  if (flaggedNames.length === 1) {
    const [name] = flaggedNames

    return {
      tone: 'error',
      glyph: 'warning',
      title: GROCERY_AMOUNT_INCREASED_TITLE,
      // Decoded rows always carry a string name, so emptiness is the only case left to answer for.
      body:
        name.trim() === ''
          ? GROCERY_AMOUNT_INCREASED_BODY_UNNAMED
          : stringWithNamedParameters(GROCERY_AMOUNT_INCREASED_BODY_TEMPLATE, {name})
    }
  }

  return {
    tone: 'error',
    glyph: 'warning',
    title: stringWithNamedParameters(GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE, {n: flaggedNames.length}),
    body: stringWithNamedParameters(GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE, {n: flaggedNames.length})
  }
}

/**
 * Folds every section sharing a category code into the first one that claimed it, concatenating their rows in
 * the order they arrived.
 *
 * One block per aisle is what the list downstream requires rather than a tidiness: `buildGroceryViewModel`
 * keys each block by its category, so two sections carrying one code would hand the `FlatList` two cells
 * under the same key — a React duplicate-key error, two identical aisle headings, and cell reuse across the
 * wrong section. The converter collapses an aisle code this version does not know onto the catch-all
 * (`convertGroceryList`), so a response holding both an unknown aisle and a real 'Pantry & other' is the
 * ordinary way two sections come to share a code, and 0.7.5's backend-before-mobile release order makes that
 * a matter of when rather than whether. Merging is applied here, at the point the keys are derived, so the
 * invariant holds for any list this screen is handed and not only for one the converter produced.
 *
 * Neither the input nor any array inside it is touched: each merged section owns a fresh item array.
 */
function mergeSectionsByCategory(sections: GrocerySection[]): GrocerySection[] {
  const merged: GrocerySection[] = []

  sections.forEach(section => {
    const claimed = merged.find(candidate => candidate.category === section.category)

    if (claimed === undefined) {
      merged.push({category: section.category, items: [...section.items]})

      return
    }

    claimed.items.push(...section.items)
  })

  return merged
}

/**
 * Aisles run in store order and 'Pantry & other' closes the list (37:157), so a category code this version does
 * not know sorts after the named aisles but ahead of that closer. Checked rows belong to the Checked block alone,
 * so they are dropped here whether or not the server pre-filtered them — along with any aisle they empty, which
 * would otherwise render as a bare header. What survives holds one section per category code, so the caller can
 * key a list off that code.
 */
export function orderGrocerySections(sections: GrocerySection[]): GrocerySection[] {
  const stocked: GrocerySection[] = mergeSectionsByCategory(
    sections
      .map(section => ({category: section.category, items: section.items.filter(item => !item.isChecked)}))
      .filter(section => section.items.length > 0)
  )

  const namedAisles = AISLE_ORDER.flatMap(category => stocked.filter(section => section.category === category))
  const unknownAisles = stocked.filter(
    section => !AISLE_ORDER.includes(section.category) && section.category !== CLOSING_AISLE
  )
  const closingAisle = stocked.filter(section => section.category === CLOSING_AISLE)

  return [...namedAisles, ...unknownAisles, ...closingAisle]
}

/**
 * 37:260 makes the flagged row the Checked card's first row, so an amount that went up is the first thing read
 * in that block rather than something to hunt for among the struck-through rows. Neither the response nor the
 * optimistic repartition orders them, so the order is derived here; within each group the server's own order is
 * preserved, which keeps the rows stable as items are checked off.
 */
export function orderCheckedItems(items: GroceryItem[]): GroceryItem[] {
  const flagged = items.filter(item => groceryRowVariant(item) === 'flagged')
  const unflagged = items.filter(item => groceryRowVariant(item) !== 'flagged')

  return [...flagged, ...unflagged]
}

export function groceryCategoryLabel(category: string): string {
  return lookupLabel(GROCERY_CATEGORY_LABELS, category) ?? GROCERY_CATEGORY_LABELS[CLOSING_AISLE]
}

/**
 * Composes the whole of what 14 / 14b render from one decoded list: the aisle blocks in store order with their
 * labels and the `isFirst` flag `CategoryLabel` turns into the opening aisle's taller padding-top, the Checked
 * block (37:320) with its "Checked · n" heading and its flagged-row-first ordering, the banner the flagged rows
 * both pluralise and name (0.7.4) and the visibility of the "Uncheck all" action — which renders only when
 * something is checked, so 14 never draws a control that would do nothing (0.2.5).
 *
 * The flagged rows are scanned once, and the banner and `flagCount` both read that one scan, so the sentence
 * above the list and the number reported beside it can never disagree about what is flagged.
 *
 * Pure in the list: no member of it, and no array inside it, is mutated, so the same list always yields the
 * same model and the caller can memoise on the list's own identity.
 */
export function buildGroceryViewModel(list: GroceryList): GroceryViewModel {
  const categoryBlocks: GroceryBlock[] = orderGrocerySections(list.sections).map((section, index) => ({
    kind: 'category',
    key: `${CATEGORY_BLOCK_KEY_PREFIX}${section.category}`,
    label: groceryCategoryLabel(section.category),
    isFirst: index === 0,
    items: section.items
  }))

  const checkedBlocks: GroceryBlock[] =
    list.checkedItems.length > 0
      ? [
          {
            kind: 'checked',
            key: CHECKED_BLOCK_KEY,
            title: stringWithNamedParameters(GROCERY_CHECKED_HEADER_TEMPLATE, {n: list.checkedCount}),
            items: orderCheckedItems(list.checkedItems)
          }
        ]
      : []

  const flaggedNames = flaggedItemNames(list.checkedItems)

  return {
    blocks: [...categoryBlocks, ...checkedBlocks],
    banner: groceryBanner(list.banner, flaggedNames),
    showsUncheckAll: shouldShowUncheckAll(list.checkedCount),
    flagCount: flaggedNames.length
  }
}

// Mirrors ContentColumn's own geometry so a Skeleton placeholder measures the same as the card it stands in for.
// Clamped because Skeleton sizes its sweep from this number: a window the gutters exhaust has to collapse the
// placeholder to nothing, the way every other derivation here does, rather than hand it a negative or a NaN.
export function contentColumnWidth(windowWidth: number): number {
  const column = Math.min(windowWidth, Sizes.CONTENT_MAX_WIDTH) - Spacing.GUTTER * 2

  if (!Number.isFinite(column) || column <= 0) {
    return 0
  }

  return column
}
