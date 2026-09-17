import {MealPlan} from '@data/models/MealPlan'
import {GeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {generatePlan} from '@queries/api/mealPlanning/generatePlan'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildGeneratePlanMutationOptions} from './useGeneratePlanMutation.util'

export const useGeneratePlanMutation = (): UseMutationResult<MealPlan, Error, GeneratePlanPayload> => {
  const queryClient = useQueryClient()

  return useMutation({...buildGeneratePlanMutationOptions(queryClient), mutationFn: generatePlan})
}
