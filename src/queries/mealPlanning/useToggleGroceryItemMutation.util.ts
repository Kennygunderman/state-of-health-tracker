import type {GroceryItem, GroceryList, ToggleGroceryItemResult} from '@data/models/GroceryList'
import {repartitionGroceryList} from '@data/models/GroceryList'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export interface ToggleGroceryItemVariables {
  itemId: string
  isChecked: boolean
}

export interface ToggleGroceryItemContext {
  previousList: GroceryList | undefined
}

const toggleRow = (item: GroceryItem, itemId: string, isChecked: boolean): GroceryItem =>
  item.id === itemId ? {...item, isChecked, flag: null} : item

// The toggled row changes collection, which is the whole optimistic effect: GroceryList draws the aisles from
// the unchecked rows and the checked card from the checked ones, so a ticked row left in its aisle would
// vanish under the shopper's finger and an unticked row left in the checked card would sit under
// "Checked · n" while reading as unchecked. repartitionGroceryList moves it and recounts from the rows, so a
// repeated tap cannot drift the count.
const applyToggle = (list: GroceryList, itemId: string, isChecked: boolean): GroceryList =>
  repartitionGroceryList(list, item => toggleRow(item, itemId, isChecked))

export function buildToggleGroceryItemMutationOptions(
  queryClient: QueryClient,
  planId: string
): Omit<
  UseMutationOptions<ToggleGroceryItemResult, Error, ToggleGroceryItemVariables, ToggleGroceryItemContext>,
  'mutationFn'
> {
  return {
    mutationKey: mutationKeys.toggleGroceryItem,
    onMutate: async ({itemId, isChecked}) => {
      // A refetch already in flight would land after the optimistic write and erase it, so it is cancelled first.
      await queryClient.cancelQueries({queryKey: queryKeys.groceryList(planId)})

      const previousList = queryClient.getQueryData<GroceryList>(queryKeys.groceryList(planId))

      if (previousList !== undefined) {
        queryClient.setQueryData(queryKeys.groceryList(planId), applyToggle(previousList, itemId, isChecked))
      }

      return {previousList}
    },
    onError: (error, _variables, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(queryKeys.groceryList(planId), context.previousList)
      }

      if (getApiErrorCode(error) === API_ERROR_CODES.planNotActive) {
        queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.groceryList(planId)})
    }
  }
}
