import type {MealPlanPreferencesSaveResult, SaveMealPlanPreferencesPayload} from '@data/models/MealPlanPreferences'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export function buildSavePreferencesMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<MealPlanPreferencesSaveResult, Error, SaveMealPlanPreferencesPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.savePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
      queryClient.invalidateQueries({queryKey: queryKeys.targetEstimate})
      queryClient.invalidateQueries({queryKey: queryKeys.nutritionTargets})
      queryClient.invalidateQueries({queryKey: queryKeys.affectedMealsAll})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
      queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
      // Removed, not invalidated: a cached preview is bound to the preferences it was computed against.
      queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
    }
  }
}
