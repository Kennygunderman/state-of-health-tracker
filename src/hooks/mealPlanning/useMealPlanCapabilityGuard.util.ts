/**
 * The pure half of the capability guard every gated meal-planning screen mounts: what the session's entitlement
 * means for a screen that is already open.
 *
 * It answers two different questions, and they are not the same question asked twice. `isGatedRequestAllowed`
 * is about requests — may this screen issue one at all. `isCapabilityUnavailable` is about the screen — has the
 * server confirmed the capability off, so that there is nothing here to retry and the screen must leave. A
 * screen that reads only the first keeps offering a Try again that the query client will not even attempt,
 * because a confirmed failure is not retryable (`shouldRetryQuery` in `src/queries/queryClient.ts`); a screen
 * that reads only the second can still fire a probe on the way out.
 *
 * The derivation lives here rather than in the hook beside it so it is assertable without a renderer, which is
 * the only way anything in this repository tests hook behaviour (AAP 0.4.1 installs no renderer and no Testing
 * Library, and this plan does not add one).
 */
import {MealPlanAvailability, MealPlanEntitlement} from '@utility/MealPlanEntitlementUtility'

export interface MealPlanCapabilityGuard {
  /**
   * Whether a gated request may be issued from this screen — false as soon as either unavailability signal of
   * AAP 0.2.5 has been seen this session, and it stays false, because a route that answered
   * `503 feature_disabled` or a bare 404 answers the next probe identically.
   */
  isGatedRequestAllowed: boolean
  /**
   * Whether the server has CONFIRMED the capability off, which is a gated screen's one terminal answer: it is
   * not this plan, this recipe or this save that failed, it is the feature, so no recovery that stays on the
   * screen can succeed and the screen leaves for the tab that states the refusal once (AAP 0.2.5).
   */
  isCapabilityUnavailable: boolean
}

/**
 * The one availability the guard treats as terminal.
 *
 * `'disabled'` is deliberately excluded. It means the Remote Config flag is off, which is not something a user
 * can be sitting inside a gated screen and then meet: the flag is read once per launch (AAP 0.4.3, 0.7.5 — a
 * console change reaches a device on its next cold start), and while it is off the Meal Plan segment renders no
 * entry to any of these screens. Treating it as a departure would add a path nothing can take, and would make a
 * launch-time flag read look like a mid-session revocation the app does not implement.
 */
const TERMINAL_AVAILABILITY: MealPlanAvailability = 'unavailable'

export const resolveMealPlanCapabilityGuard = ({
  availability,
  isGatedRequestAllowed
}: MealPlanEntitlement): MealPlanCapabilityGuard => ({
  isGatedRequestAllowed,
  isCapabilityUnavailable: availability === TERMINAL_AVAILABILITY
})
