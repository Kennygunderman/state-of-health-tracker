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
      // The Diary and Macros History resolve their targets from the macros responses, so a target save has
      // to reach the whole dailyMacros family — every cached day, not one date — or the two surfaces disagree.
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
