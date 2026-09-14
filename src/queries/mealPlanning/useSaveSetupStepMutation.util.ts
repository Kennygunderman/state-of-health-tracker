import type {MealPlanPreferencesSaveResult, SetupStepRequest} from '@data/models/MealPlanPreferences'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export function buildSaveSetupStepMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<MealPlanPreferencesSaveResult, Error, SetupStepRequest>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.saveSetupStep,
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
