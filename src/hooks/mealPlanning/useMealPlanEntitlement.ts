import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {isMealPlanningEnabled} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'

import {MealPlanEntitlement, resolveMealPlanEntitlement} from './useMealPlanEntitlement.util'

/**
 * Whether meal planning is entitled for this session, and which of its surfaces may therefore be shown.
 *
 * The entitlement is returned exactly as `resolveMealPlanEntitlement` decided it, with nothing re-applied on
 * top. In particular `isCatalogVisible` is the resolver's verdict: the two unavailability signals of AAP 0.2.5
 * — (a) a gated route answering `503 feature_disabled`, (b) a bare 404 from one of the resource-less GETs —
 * agree on the Meal Plan segment's unavailable card but not on Add Food, because `/catalog/*` is never gated by
 * the server's `MEAL_PLANNING_ENABLED` (AAP 0.3.1, 0.5.1). Under signal (a) catalog search still answers and
 * the section stays, which is the outcome the operator scenario in AAP 0.9.4 requires; only signal (b), a
 * backend rolled back past `/catalog/*` as well, hides it. Narrowing that here — by ANDing
 * `availability !== 'unavailable'` into the flag, as an earlier revision did — would take a working surface
 * away from the operator and override the policy under test in `@utility/MealPlanEntitlementUtility`.
 *
 * The Remote Config flag and the three resource-less GETs that reveal a rolled-back backend are combined by the
 * pure `resolveMealPlanEntitlement`; this hook only supplies its inputs. It renders nothing, routes nothing and
 * writes nothing — no toast, no navigation, no store write and no cache write — so any number of screens may
 * call it. Deciding what the Meal Plan body shows is `MealPlanTab/index.util.ts::resolveMealPlanBody`'s job,
 * not this hook's.
 */
export const useMealPlanEntitlement = (): MealPlanEntitlement => {
  const isFlagEnabled = isMealPlanningEnabled()
  // The session's day key is subscribed here and handed to the current-plan query, which refetches when it
  // moves: the app re-evaluates "today" on every foreground, and which plan is current follows that date.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)
  // The two gated queries are called unconditionally and suppressed through enabled rather than by skipping
  // the call, which rules-of-hooks forbids. Targets takes no flag: it is never gated by the server, and its
  // error is still read here because a bare 404 from it is one of the rolled-back-backend signals.
  const {error: preferencesError} = useMealPlanPreferencesQuery(isFlagEnabled)
  const {data: plans, error: currentPlanError} = useCurrentMealPlanQuery(isFlagEnabled, sessionDayKey)
  const {error: targetsError} = useNutritionTargetsQuery()

  return resolveMealPlanEntitlement({
    isFlagEnabled,
    // The operative rollback probe: a feature-bearing backend answers these resource-less GETs with 200 and
    // null members, so a bare 404 can only mean the routes are not mounted — the whole of AAP 0.2.5 signal
    // (b). The three probes are alternatives, not a quorum.
    preferencesError,
    currentPlanError,
    // The targets read carries signal (b) too: `fetchNutritionTargets` throws the typed `RoutesMissingError`
    // on a bare 404, which `isRoutesMissingError` recognises. Throwing rather than resolving to `null` is what
    // keeps both halves of that answer — the entitlement reads the error here, while the target surfaces
    // Account, Progress and the Diary editor still degrade to the local value as AAP 0.7.5 requires, because
    // they select their fallback from the absence of data rather than from this error.
    targetsError,
    hasPlan: Boolean(plans?.current ?? plans?.upcoming)
  })
}
