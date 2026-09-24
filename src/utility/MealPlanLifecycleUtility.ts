import {MEAL_PLAN_LIFECYCLES, MealPlanLifecycle} from '@data/models/MealPlan'

/**
 * The server's verdict on whether a plan still accepts writes, resolved from the wire.
 *
 * THE CLIENT NEVER DERIVES THIS. Whether a week has ended is a comparison against the calendar day of the
 * user's SAVED IANA zone — the zone their last preferences save stored, which the AAP keeps as a home zone
 * rather than re-deriving per request. The app does not hold that zone, so the device's day is not a
 * substitute for it: after travel the two disagree, and at one instant a plan ending on the device's own day
 * is already over in the saved zone. A local derivation would then report a finished week as writable and the
 * screens would offer a Swap and a Log that every write path refuses `409 plan_not_active {reason: 'ended'}` —
 * the exact mismatch this verdict exists to close. `GET .../days/:date` computes it and this module only
 * resolves what it answered; there is deliberately no function here that takes a day key.
 *
 * WHY THIS IS ITS OWN UTILITY. The resolution is needed by the query layer and the lifecycle vocabulary by the
 * plan screens, and neither tree may import the other's util (Rule mobile-component-structure). A second
 * spelling of "does this plan still accept writes" is how a finished week becomes writable on one surface and
 * not another.
 */
export interface PlanWriteability {
  lifecycle: MealPlanLifecycle
  isWritable: boolean
}

const KNOWN_LIFECYCLES = MEAL_PLAN_LIFECYCLES as string[]

/**
 * The conservative reading of a lifecycle this build does not recognise. A value outside the union can only
 * come from a newer server, and reading it as 'active' would offer writes the server may refuse; 'superseded'
 * renders the day read-only, which is recoverable, and is the same fallback the envelope's `planStatus` takes.
 */
const UNRECOGNISED_LIFECYCLE: MealPlanLifecycle = 'superseded'

const WRITABLE_LIFECYCLE: MealPlanLifecycle = 'active'

/**
 * The verdict a day response carried, as the pair the model declares.
 *
 * Both wire members are read and the result is their CONJUNCTION: an unrecognised lifecycle is never writable,
 * and a server answering `isWritable: false` is believed whatever lifecycle it names — a future reason to
 * refuse writes that this build has no word for must still close the door rather than be reasoned away.
 */
export const resolveEnvelopeWriteability = (lifecycle: string, isWritable: boolean): PlanWriteability => {
  const resolved = KNOWN_LIFECYCLES.includes(lifecycle) ? (lifecycle as MealPlanLifecycle) : UNRECOGNISED_LIFECYCLE

  return {lifecycle: resolved, isWritable: isWritable && resolved === WRITABLE_LIFECYCLE}
}

/**
 * Whether a verdict permits the write-bearing controls to be offered.
 *
 * The one place `=== true` is spelled, so "unknown" can never be read as permission by a caller reaching for
 * truthiness: `null` is a day query that has not answered (including the envelope seeded from the cached
 * week), `undefined` is no envelope at all, and both mean the same thing — do not offer the write yet.
 */
export const isWriteAllowedByVerdict = (isWritable: boolean | null | undefined): boolean => isWritable === true

/**
 * Whether a verdict positively refuses writes, which is a different question from {@link isWriteAllowedByVerdict}
 * being false.
 *
 * Only an answered `false` is a refusal. A screen showing "this plan is no longer active" on an unanswered
 * verdict would be claiming the plan is dead because its own request is still in flight.
 */
export const isWriteRefusedByVerdict = (isWritable: boolean | null | undefined): boolean => isWritable === false

/**
 * Whether no verdict has been answered yet — the third state, and the reason the other two are separate
 * predicates rather than one boolean.
 *
 * `null` is the display-only seeded envelope, `undefined` is no envelope at all, and the difference from a
 * refusal is user-visible: a refused plan gets an explanation, while an unanswered one gets the app's ordinary
 * disabled treatment until the day route replies. Together these three are mutually exclusive and cover every
 * value the member can hold.
 */
export const isWriteVerdictUnknown = (isWritable: boolean | null | undefined): boolean =>
  isWritable === null || isWritable === undefined
