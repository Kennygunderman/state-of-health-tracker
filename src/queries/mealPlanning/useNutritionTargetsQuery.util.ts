import {NutritionTargets} from '@data/models/NutritionTargets'
import {isRoutesMissingError} from '@utility/MealPlanEntitlementUtility'
import {hasAnyTargetValue} from '@utility/NutritionFormatUtility'

/**
 * How a targets read is read, for a surface that shows a target and for the entitlement that reads the same
 * read as a capability signal.
 *
 * `fetchNutritionTargets` throws a `RoutesMissingError` for a bare 404 instead of resolving it to `null`
 * (AAP 0.2.5 signal (b)), so the answer "this route is not mounted" arrives on the error channel rather than
 * as data. These three functions are what keeps that from leaking into every consumer: a target surface asks
 * for the value it should display and gets the same fallback it always had, while the one consumer that cares
 * about *why* the read did not answer asks with a predicate.
 *
 * `resolveTargetAuthority` at the foot of the module composes that classification into the one routing answer
 * Account, the Diary summary card and Progress Activity all need: which writer owns the user's calorie target.
 */

/**
 * A targets read as a consumer receives it. Both `isError` and `error` are required rather than optional
 * because the classification below is the point of this module: a caller that passed `data` alone would skip
 * it silently and get back a value the read no longer stands behind. A `useQuery` result and the
 * `QueryObserverResult` a `refetch()` resolves with both satisfy this shape without a cast.
 */
export interface NutritionTargetsReadResult {
  data?: NutritionTargets | undefined
  isError: boolean
  error: unknown
}

/**
 * Whether the targets route answered that it is not mounted — the rolled-back-backend capability signal, not
 * a read failure and not something a retry can change.
 *
 * Keyed on `isError` rather than on `error` alone because TanStack keeps the previous error object on a
 * result that has since succeeded, so a stale `error` would otherwise report unavailability over a successful
 * read.
 */
export const isNutritionTargetsRouteMissing = (result: {isError: boolean; error: unknown}): boolean =>
  result.isError && isRoutesMissingError(result.error)

/**
 * Whether the targets read genuinely failed — anything but the route-missing signal.
 *
 * This is the one a retry affordance belongs to. Offering "Try again" for a route that is not mounted would
 * be a dead control: the next attempt answers identically until the backend is rolled forward, so a surface
 * that draws a retry card must ask this rather than `isError`.
 */
export const isNutritionTargetsReadFailure = (result: {isError: boolean; error: unknown}): boolean =>
  result.isError && !isRoutesMissingError(result.error)

/**
 * The server-held targets a surface should display, or `null` when there are none to display and the local
 * target is what the user gets (AAP 0.7.5).
 *
 * Two different absences resolve to that same `null`, and one of them is only visible if the whole result is
 * classified rather than just its `data`:
 *
 * - **No data.** A successful read that holds no figures is data (`NutritionTargets.targets === null` — a user
 *   who has never confirmed a target), so it is returned as such. An absent `data` member is the unanswered
 *   read: a first load still in flight, or one that failed before it ever answered.
 * - **A route-missing answer, even with data retained.** TanStack keeps the last successful `data` on a result
 *   whose refetch failed, which is deliberate for a transient failure and wrong for this one: a backend rolled
 *   back past `/meal-planning/targets*` holds no server targets at all, and AAP 0.7.5 requires those surfaces
 *   to degrade to the local value exactly as they behave for a user who never opted in. Returning the retained
 *   figures would instead keep presenting server targets from a server that no longer has the route — while the
 *   Meal Plan segment, reading the same error, already shows its unavailable card.
 *
 * A *generic* read failure keeps its retained data on purpose, which is the distinction this selector draws: a
 * 500 or a lost connection says nothing about whether the server still holds those targets, so the last
 * answer stays on screen (stale-while-revalidate) and only the surface's own retry affordance reacts —
 * `isNutritionTargetsReadFailure` is what that affordance asks. Nothing here clears anything: the cache keeps
 * the entry, and this is a read-time selection.
 */
export const selectNutritionTargets = (result: NutritionTargetsReadResult): NutritionTargets | null =>
  isNutritionTargetsRouteMissing(result) ? null : (result.data ?? null)

/**
 * Who owns the calorie target a surface is showing, and therefore which writer may change it.
 *
 * `'server'` — `users.target_*` holds at least one figure, so `PUT /meal-planning/targets` is the only writer
 * allowed to move it (AAP 0.1.3). `'local'` — no server target is in hand to contradict, so the device's
 * `useUserData.targetCalories` stays in charge exactly as it does for a user who never opted in (AAP 0.1.4).
 *
 * There is no third value, and the absence is the policy. AAP 0.1.4 states the rule as a pair — the three
 * writers open `MealPlanEditTargets` "when server targets exist and the legacy `TargetCaloriesModal`
 * otherwise" — so a read that has not yet said which belongs to `otherwise`, not to a state of its own. A
 * third value cost the app its shipped behaviour: it left Account's row, the Diary ring and Progress
 * Activity's intake row inert, and an inert control is what AAP 0.1.4 forbids, while AAP 0.1.4 also requires
 * non-opted-in and signed-out behaviour to be unchanged — before this feature those three controls always
 * opened the legacy modal.
 */
export type TargetAuthority = 'server' | 'local'

/**
 * The two target writers this app has: the canonical full-screen `MealPlanEditTargets`, which saves through the
 * single meal-planning writer, and the legacy `TargetCaloriesModal`, which writes the device value alone.
 */
export type TargetEditor = 'canonical' | 'legacy'

export interface TargetAuthorityInput {
  read: NutritionTargetsReadResult
  isAuthed: boolean
}

export interface TargetAuthorityDecision {
  authority: TargetAuthority
  editor: TargetEditor
  serverCalories: number | null
}

const EDITOR_BY_AUTHORITY: Record<TargetAuthority, TargetEditor> = {
  server: 'canonical',
  local: 'legacy'
}

// `editor` and the presence of a server figure are derived from `authority` instead of being written out per
// branch, so a consumer can never be handed a decision whose members disagree with each other. `editor` is
// non-nullable because every authority names a writer: there is no state in which a target this app has always
// let the user edit becomes uneditable.
const targetAuthorityDecision = (
  authority: TargetAuthority,
  serverCalories: number | null = null
): TargetAuthorityDecision => ({
  authority,
  editor: EDITOR_BY_AUTHORITY[authority],
  serverCalories: authority === 'server' ? serverCalories : null
})

/**
 * The target-authority routing policy for the three surfaces that offer to edit a calorie target outside the
 * planner — Account's Target Calories row, the Diary summary card and Progress Activity's intake target. One
 * policy rather than three inline expressions, because they all edit the same value: any disagreement means one
 * account edits its target in the canonical editor on one tab and in the local-only modal on another.
 *
 * Exactly one branch answers `'server'`, and everything else is the `otherwise` AAP 0.1.4 names — the device
 * value with the legacy modal, which is what these three controls did before this feature existed. So every
 * decision names a writer and no state is inert:
 *
 * 1. **Signed out → `'local'`.** A device with no session holds no server targets and cannot acquire any —
 *    `httpRequest` throws for a missing Firebase token before reaching the network — so a guest's read is a
 *    generic failure carrying no data. AAP 0.1.4 keeps signed-out behaviour unchanged, so the guest keeps the
 *    local target they have always been able to edit.
 * 2. **No server targets in hand → `'local'`.** `selectNutritionTargets` collapses three absences into this
 *    one answer, and they all mean the same thing for routing. A *successful* read holding no figures is a
 *    user who never confirmed a target. A *route-missing* answer is a backend rolled back past
 *    `/meal-planning/targets*`, which holds no server targets at all and which AAP 0.7.5 requires these
 *    surfaces to survive by degrading to the local value. An *unanswered* read — a first load still in flight,
 *    or a failure that happened before any answer arrived — has no server figure to route to either, and AAP
 *    0.2.5 is explicit that nothing is cleared and nothing blanks: the surfaces show the last local value and
 *    the local editor, exactly as for a user who never opted in. Treating that last case as a state of its own
 *    is what made the three controls inert on every cold start.
 * 3. **Server figures → `'server'`.** `hasAnyTargetValue` decides, not `targets.calories`: the four columns are
 *    independently nullable (AAP 0.5.2), so an account holding only protein has server targets just as much as
 *    a calories-only one, and reading calories alone would route it to the local modal while the planner
 *    treated it as opted in.
 *
 * A *generic* read failure that kept its last data still decides from that data, because
 * `selectNutritionTargets` deliberately keeps it: a 500 or a dropped connection says nothing about who owns the
 * target, so an offline opted-in user keeps the canonical editor and an offline never-opted-in user keeps the
 * modal. A failure that never carried data lands in branch 2 with the local editor rather than nothing —
 * momentarily routing a would-be canonical edit to the local modal is a value one screen has to reconcile,
 * while a control that does nothing is a defect on every surface at once.
 *
 * `serverCalories` is the server's own figure and is `null` whenever it has none — including for a macro-only
 * `'server'` account, which correctly shows its local calorie figure while still editing in the canonical
 * editor. Consumers render `decision.serverCalories ?? localCalories`; the local value is not folded in here,
 * which is what keeps this pure and independent of the store.
 *
 * This decision routes *editing* only. It never chooses what a surface displays when that surface has its own
 * source for the figure: the Diary summary card reads the target embedded in `GET /macros/:date` through
 * `@screens/Macros/index.util::resolveMacroTargets`, unchanged from before this feature, because AAP 0.1.3
 * states that the Diary and Macros History keep reading the embedded targets and that both reads resolve to
 * the same `users.target_*` columns once `dailyMacros` is invalidated by every target save.
 */
export const resolveTargetAuthority = (input: TargetAuthorityInput): TargetAuthorityDecision => {
  if (!input.isAuthed) {
    return targetAuthorityDecision('local')
  }

  const targets = selectNutritionTargets(input.read)

  if (targets === null) {
    return targetAuthorityDecision('local')
  }

  if (!hasAnyTargetValue(targets)) {
    return targetAuthorityDecision('local')
  }

  return targetAuthorityDecision('server', targets.targets?.calories ?? null)
}

/**
 * Whether the legacy writer may be on screen at this moment: the user asked for it, AND the authority still
 * says the device owns the target.
 *
 * Asking again on every render is the point. `resolveTargetAuthority` decides which editor a press may open,
 * but the legacy modal outlives that press — it is a mounted component holding its own visibility — and the
 * authority can move underneath it while it is open: another device confirms targets and the next refetch
 * answers `'server'`. Its button writes `useUserData.targetCalories` and nothing else, so a write that lands
 * after the authority has moved off `'legacy'` goes somewhere no other surface reads — the same silent loss the
 * press-time check exists to prevent (AAP 0.1.4). Gating visibility on the current decision takes the button
 * away in the very render the authority changes, rather than one effect later.
 */
export const isLegacyTargetEditorOpen = (decision: TargetAuthorityDecision, isRequested: boolean): boolean =>
  isRequested && decision.editor === 'legacy'

/**
 * An identity for the current authority, for a row whose modal state sits inside a component this feature may
 * not modify.
 *
 * Account's target row is an `AccountListItem`, which owns its own modal visibility and renders the legacy
 * modal itself; AAP 0.8.2 freezes that component, so its state cannot be reached from outside — but the row
 * can be replaced. Used as a React `key`, this value remounts the row when the authority changes, which resets
 * that internal state and takes an open modal with it, and is identical while the authority is unchanged, so a
 * stable authority never remounts anything.
 *
 * The editor names the identity rather than the authority, because the editor is what the row's internal state
 * belongs to: a row whose press opens the legacy modal keeps that modal across any change that leaves the
 * legacy writer in charge, and loses it the moment the canonical editor takes over.
 */
export const targetAuthorityKey = (decision: TargetAuthorityDecision): string => decision.editor
