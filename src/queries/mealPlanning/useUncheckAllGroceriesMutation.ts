import type {UncheckAllGroceriesResult} from '@data/models/GroceryList'
import {uncheckAllGroceries} from '@queries/api/mealPlanning/uncheckAllGroceries'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {
  buildUncheckAllGroceriesMutationOptions,
  UncheckAllGroceriesContext
} from './useUncheckAllGroceriesMutation.util'

export const useUncheckAllGroceriesMutation = (
  planId: string
): UseMutationResult<UncheckAllGroceriesResult, Error, void, UncheckAllGroceriesContext> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildUncheckAllGroceriesMutationOptions(queryClient, planId),
    mutationFn: () => uncheckAllGroceries(planId)
  })
}
