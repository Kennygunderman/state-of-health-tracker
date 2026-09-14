import {logPlannedMeal, LogPlannedMealPayload, LogPlannedMealResult} from '@queries/api/mealPlanning/logPlannedMeal'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildLogPlannedMealMutationOptions} from './useLogPlannedMealMutation.util'

export const useLogPlannedMealMutation = (
  planId: string,
  mealId: string
): UseMutationResult<LogPlannedMealResult, Error, LogPlannedMealPayload> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildLogPlannedMealMutationOptions(queryClient),
    mutationFn: payload => logPlannedMeal(planId, mealId, payload)
  })
}
