import type {MealPlan} from '@data/models/MealPlan'
import type {GeneratePlanPayload} from '@data/models/PlanGenerationResult'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export function buildGeneratePlanMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<MealPlan, Error, GeneratePlanPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.generatePlan,
    // Unknown outcomes only, and the replay carries the same idempotency key: a generation that committed
    // before its response was lost answers the retry with its stored 201, while a confirmed refusal
    // (no_matching_meals, plan_generation_failed) is an answer the same key would only repeat.
    retry: (failureCount, error) => failureCount < 1 && isUnknownOutcome(error),
    retryDelay: 1500,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
      queryClient.invalidateQueries({queryKey: queryKeys.groceryListAll})
      queryClient.invalidateQueries({queryKey: queryKeys.affectedMealsAll})
      queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
      // Removed, not invalidated: every cached preview is bound to the plan and revision it was computed
      // against, and a generation leaves none of them addressable.
      queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
    }
  }
}
