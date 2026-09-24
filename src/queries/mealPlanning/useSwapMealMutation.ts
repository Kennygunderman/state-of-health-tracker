import {SwapMealPayload, SwapMealResult} from '@data/models/SwapAlternative'
import {swapMeal} from '@queries/api/mealPlanning/swapMeal'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSwapMealMutationOptions} from './useSwapMealMutation.util'

export const useSwapMealMutation = (
  planId: string,
  mealId: string
): UseMutationResult<SwapMealResult, Error, SwapMealPayload> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSwapMealMutationOptions(queryClient, planId),
    mutationFn: (payload: SwapMealPayload) => swapMeal(planId, mealId, payload)
  })
}
