import {MealPlan} from '@data/models/MealPlan'
import {RegeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {regeneratePlan} from '@queries/api/mealPlanning/regeneratePlan'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildRegeneratePlanMutationOptions} from './useRegeneratePlanMutation.util'

export const useRegeneratePlanMutation = (
  planId: string
): UseMutationResult<MealPlan, Error, RegeneratePlanPayload> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildRegeneratePlanMutationOptions(queryClient),
    mutationFn: (payload: RegeneratePlanPayload) => regeneratePlan(planId, payload)
  })
}
