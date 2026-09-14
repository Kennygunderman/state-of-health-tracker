import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {isMealPlanningEnabled} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'

import {MealPlanEntitlement, resolveMealPlanEntitlement} from './useMealPlanEntitlement.util'

/**
 * Whether Add Food may show its Catalog section.
 *
 * AAP 0.2.5 names two backend-unavailability signals — a gated route answering `503 feature_disabled`, and a
 * bare 404 from one of the resource-less GETs — and gives them one shared effect, which includes "Add Food's
 * Catalog section is hidden for the session". `resolveMealPlanEntitlement` implements exactly that, so this
 * returns its answer unchanged in every case; `availability === 'unavailable'` is precisely "either signal
 * fired", so the second clause can only ever agree with the first.
 *
 * It is kept as a guard rather than inlined because the resolver lives in a util this surface shares with the
 * meal-plan reads, and an earlier revision of it parted the two signals — hiding the section for the rollback
 * 404 but not for `feature_disabled`, on the reasoning that `/catalog/*` is never server-gated. That reasoning
 * is sound engineering and still the wrong answer, because the plan is the frozen contract. Pinning the plan's
 * behaviour at the surface that consumes it keeps Add Food correct whichever revision of the util it reads.
 */
export const resolveCatalogVisibility = (entitlement: MealPlanEntitlement): boolean =>
  entitlement.isCatalogVisible && entitlement.availability !== 'unavailable'

/**
 * Whether meal planning is entitled for this session, and which of its surfaces may therefore be shown.
 *
 * The Remote Config flag and the two resource-less GETs that reveal a rolled-back backend are combined by the
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

  const entitlement = resolveMealPlanEntitlement({
    isFlagEnabled,
    // The operative rollback probe: a feature-bearing backend answers these resource-less GETs with 200 and
    // null members, so a bare 404 can only mean the routes are not mounted — the whole of AAP 0.2.5 signal
    // (b). The three probes are alternatives, not a quorum.
    preferencesError,
    currentPlanError,
    // Passed for completeness, but it cannot carry signal (b): `fetchNutritionTargets` resolves a bare 404 to
    // `null` instead of throwing, because AAP 0.7.5 requires a rolled-back backend to degrade the Account,
    // Progress and Diary target surfaces to the local value rather than to an error.
    targetsError,
    hasPlan: Boolean(plans?.current ?? plans?.upcoming)
  })

  return {...entitlement, isCatalogVisible: resolveCatalogVisibility(entitlement)}
}
