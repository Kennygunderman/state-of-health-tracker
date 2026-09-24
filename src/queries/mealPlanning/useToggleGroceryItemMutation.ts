import type {ToggleGroceryItemResult} from '@data/models/GroceryList'
import {toggleGroceryItem} from '@queries/api/mealPlanning/toggleGroceryItem'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {
  buildToggleGroceryItemMutationOptions,
  ToggleGroceryItemContext,
  ToggleGroceryItemVariables
} from './useToggleGroceryItemMutation.util'

export const useToggleGroceryItemMutation = (
  planId: string
): UseMutationResult<ToggleGroceryItemResult, Error, ToggleGroceryItemVariables, ToggleGroceryItemContext> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildToggleGroceryItemMutationOptions(queryClient, planId),
    mutationFn: ({itemId, isChecked}: ToggleGroceryItemVariables) => toggleGroceryItem(planId, itemId, {isChecked})
  })
}
