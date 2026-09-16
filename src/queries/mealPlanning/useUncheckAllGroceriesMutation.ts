import {uncheckAllGroceries} from '@queries/api/mealPlanning/uncheckAllGroceries'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildUncheckAllGroceriesMutationOptions} from './useUncheckAllGroceriesMutation.util'

export const useUncheckAllGroceriesMutation = (planId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildUncheckAllGroceriesMutationOptions(queryClient, planId),
    mutationFn: () => uncheckAllGroceries(planId)
  })
}
