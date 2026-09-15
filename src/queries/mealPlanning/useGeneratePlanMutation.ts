import {generatePlan} from '@queries/api/mealPlanning/generatePlan'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildGeneratePlanMutationOptions} from './useGeneratePlanMutation.util'

export const useGeneratePlanMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({...buildGeneratePlanMutationOptions(queryClient), mutationFn: generatePlan})
}
