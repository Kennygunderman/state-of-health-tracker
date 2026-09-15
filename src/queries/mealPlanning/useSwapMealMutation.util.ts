import type {SwapMealPayload, SwapMealResult} from '@data/models/SwapAlternative'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export function buildSwapMealMutationOptions(
  queryClient: QueryClient,
  planId: string
): Omit<UseMutationOptions<SwapMealResult, Error, SwapMealPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.swapMeal,
    // Unknown outcomes only: the replay reuses the same idempotencyKey; a confirmed swap_failed only repeats.
    retry: (failureCount, error) => failureCount < 1 && isUnknownOutcome(error),
    retryDelay: 1500,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
      queryClient.invalidateQueries({queryKey: queryKeys.groceryList(planId)})
      queryClient.invalidateQueries({queryKey: queryKeys.affectedMeals(planId)})
      queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
      // Removed, not invalidated: a cached preview is bound to the pre-swap revision.
      queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
    }
  }
}
