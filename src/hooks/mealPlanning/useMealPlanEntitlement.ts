import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {isMealPlanningEnabled} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'

import {MealPlanEntitlement, resolveMealPlanEntitlement} from './useMealPlanEntitlement.util'

export const useMealPlanEntitlement = (): MealPlanEntitlement => {
  const isFlagEnabled = isMealPlanningEnabled()
  // The current-plan query owns no store of its own and ignores an undefined day key, so the session's key is
  // read here and handed in — dropping it silently stops the plan rollover refetch.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)
  const {error: preferencesError} = useMealPlanPreferencesQuery(isFlagEnabled)
  const {data: plans, error: currentPlanError} = useCurrentMealPlanQuery(isFlagEnabled, sessionDayKey)
  const {error: targetsError} = useNutritionTargetsQuery()

  return resolveMealPlanEntitlement({
    isFlagEnabled,
    preferencesError,
    currentPlanError,
    targetsError,
    hasPlan: Boolean(plans?.current ?? plans?.upcoming)
  })
}
