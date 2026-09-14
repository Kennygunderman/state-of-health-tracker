import {NutritionTargets} from '@data/models/NutritionTargets'
import {isRoutesMissingError} from '@utility/MealPlanEntitlementUtility'

/**
 * How a targets read is read, for a surface that shows a target and for the entitlement that reads the same
 * read as a capability signal.
 *
 * `fetchNutritionTargets` throws a `RoutesMissingError` for a bare 404 instead of resolving it to `null`
 * (AAP 0.2.5 signal (b)), so the answer "this route is not mounted" arrives on the error channel rather than
 * as data. These three functions are what keeps that from leaking into every consumer: a target surface asks
 * for the value it should display and gets the same fallback it always had, while the one consumer that cares
 * about *why* the read did not answer asks with a predicate.
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
