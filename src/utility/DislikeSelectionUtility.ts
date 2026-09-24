/**
 * The bound on how many foods a user may mark as disliked, and the one rule that applies it.
 *
 * WHY THIS IS ITS OWN UTILITY. Two surfaces build this selection — screen 06's suggestion chips and screen
 * 06b's catalog search — and the wizard's draft reducers, which both go through, live in a third tree
 * (`@components/MealPlanSetupProvider`). A screen may not import another component's `index.util.ts` (Rule
 * mobile-component-structure), and a second spelling of the bound is how one surface starts refusing a
 * selection the other still offers, so the rule lives here with its test — the same promotion AAP 0.3.3 made
 * for `ServingsUtility` and this feature made for `CatalogSearchStateUtility`.
 */

/**
 * The server's bound on this answer, mirrored so the app cannot build a selection the dislikes save is
 * certain to refuse: `parseDislikedFoodIds` counts the DISTINCT ids of the submitted array against its own
 * `MAX_DISLIKED_FOOD_IDS` [backend/src/services/preferences.logic.ts] and answers `400 invalid_request`
 * above it (AAP 0.5.2), which reaches the user as nothing but a generic error toast.
 */
export const MAX_DISLIKED_FOOD_IDS = 100

/**
 * True once no further food can be added — the state a surface renders its cap notice from. It reads `>=`:
 * a selection stored before this bound existed, or one raised by an answer landing mid-visit, sits at or
 * above the cap without ever having been added to here.
 */
export const isDislikeSelectionAtCap = (selection: readonly string[]): boolean =>
  selection.length >= MAX_DISLIKED_FOOD_IDS

/**
 * Whether a proposed selection must be refused, which is the whole of how the bound is enforced — so the
 * suggestion chips, the search rows and a bulk commit cannot each answer it differently.
 *
 * A proposal is refused only when it GROWS the selection past the cap, and that is what keeps the screens
 * out of a dead end: a removal applies at every size, including from a selection already at or above the
 * cap. Distinctness is counted rather than length, because the server counts distinct ids. Nothing here
 * trims a list to fit, so a selection already stored round-trips whole.
 */
export const refusesDislikeSelection = (proposed: readonly string[], current: readonly string[]): boolean =>
  proposed.length > current.length && new Set(proposed).size > MAX_DISLIKED_FOOD_IDS
