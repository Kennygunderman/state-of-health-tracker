import {logPlannedMeal, LogPlannedMealPayload} from '@queries/api/mealPlanning/logPlannedMeal'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildLogPlannedMealMutationOptions} from './useLogPlannedMealMutation.util'

export const useLogPlannedMealMutation = (planId: string, mealId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildLogPlannedMealMutationOptions(queryClient),
    mutationFn: (payload: LogPlannedMealPayload) => logPlannedMeal(planId, mealId, payload)
  })
}
