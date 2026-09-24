import {useCallback, useEffect} from 'react'

import {Navigation} from '@navigation/types'
import {useNavigation} from '@react-navigation/native'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {MealPlanEntitlement} from '@utility/MealPlanEntitlementUtility'

import Screens from '@constants/screens'

import {MealPlanCapabilityGuard, resolveMealPlanCapabilityGuard} from './useMealPlanCapabilityGuard.util'
import {useMealPlanEntitlement} from './useMealPlanEntitlement'

/**
 * Every access this hook makes, in one injectable object — the same seam `useMealPlanEntitlement` uses, and for
 * the same reason: no renderer or Testing Library is installed (AAP 0.4.1), so the only way to pin that the
 * departure fires on the terminal verdict and on nothing else is to invoke the hook with fakes in plain Jest.
 */
export interface MealPlanCapabilityGuardHooks {
  useEntitlement: () => MealPlanEntitlement
  /** Returns the action that leaves for the Meal Plan tab, stable enough to be an effect dependency. */
  useDepartToPlanTab: () => () => void
}

/**
 * The app's canonical treatment for a confirmed capability refusal, in one place.
 *
 * Select the Meal Plan segment, then return to Macros. NO TOAST: the refusal is stated exactly once, by that
 * segment's neutral no-CTA unavailable card (AAP 0.2.5), and a toast on top of it would say the same thing
 * twice in two voices. NO REFETCH either — the error that produced the departure is already in the query cache,
 * which is where the entitlement recorder reads the signal that raises the card, so re-reading the current plan
 * would be a gated request issued *after* a confirmed refusal, the one thing AAP 0.2.5 says a latched client
 * must not do, against a route that has just refused it.
 *
 * `popTo` rather than `goBack`, because a gated screen can be several pushes deep — a setup step reached from
 * the review screen, a grocery list reached from a plan day — and one step back would land on another screen
 * that cannot answer either.
 *
 * This is the treatment `SwapMeal` and `SwapPreview` already give this answer; the point of naming it here is
 * that every other gated screen gives the same one rather than inventing a second vocabulary for it.
 */
const useDepartToPlanTab = (): (() => void) => {
  const navigation = useNavigation<Navigation>()
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  return useCallback(() => {
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [navigation, setMacrosSegment])
}

export const defaultMealPlanCapabilityGuardHooks: MealPlanCapabilityGuardHooks = {
  useEntitlement: useMealPlanEntitlement,
  useDepartToPlanTab
}

/**
 * The guard a gated meal-planning screen mounts so that a confirmed `503 feature_disabled` — from ANY gated
 * route, its own reads included, and from a setup save or a keyed write just as much as from a read — takes the
 * user to the one surface that explains it, instead of leaving them on a Try again that cannot succeed.
 *
 * Why a screen needs this at all, when the entitlement already records the verdict: recording is what makes the
 * Meal Plan segment truthful, and the segment is not what the user is looking at. A setup step, a grocery list,
 * a planned-meal log or a plan-settings screen sits pushed over it, holds its own failed read or save, and would
 * otherwise render that failure as a transient one — the finding this guard closes. The screens keep their own
 * transient recovery untouched: a timeout, a dropped connection or an undecodable body is still a retry, because
 * only a confirmed capability refusal reaches `isCapabilityUnavailable`.
 *
 * Returns the guard so a caller can also gate a read it is about to issue, which matters on the one path where
 * a screen can be *mounted* while the verdict already holds: navigation state restored onto a gated screen,
 * where the tab that would otherwise have shown the unavailable card was never rendered.
 */
export const useMealPlanCapabilityGuard = (
  hooks: MealPlanCapabilityGuardHooks = defaultMealPlanCapabilityGuardHooks
): MealPlanCapabilityGuard => {
  const entitlement = hooks.useEntitlement()
  const departToPlanTab = hooks.useDepartToPlanTab()

  const guard = resolveMealPlanCapabilityGuard(entitlement)

  useEffect(() => {
    if (!guard.isCapabilityUnavailable) {
      return
    }

    departToPlanTab()
  }, [departToPlanTab, guard.isCapabilityUnavailable])

  return guard
}
