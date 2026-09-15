import type {SaveNutritionTargetsPayload, SaveNutritionTargetsResult} from '@data/models/NutritionTargets'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export function buildSaveNutritionTargetsMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<SaveNutritionTargetsResult, Error, SaveNutritionTargetsPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.saveNutritionTargets,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.nutritionTargets})
      queryClient.invalidateQueries({queryKey: queryKeys.targetEstimate})
      // Diary and history read targets from the macros responses, so this must reach every cached day, not one date.
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacrosAll})
      queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
      queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
      // Removed, not invalidated: a cached preview's ranking and deltas are bound to the targets it was built on.
      queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
    }
  }
}
