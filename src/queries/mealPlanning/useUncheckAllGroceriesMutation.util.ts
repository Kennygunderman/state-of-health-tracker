import type {GroceryItem, GroceryList, UncheckAllGroceriesResult} from '@data/models/GroceryList'
import {repartitionGroceryList} from '@data/models/GroceryList'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export interface UncheckAllGroceriesContext {
  previousList: GroceryList | undefined
}

const uncheckRow = (item: GroceryItem): GroceryItem =>
  item.isChecked || item.flag !== null ? {...item, isChecked: false, flag: null} : item

// sections hold the unchecked rows and checkedItems the checked ones, so clearing every tick re-files each
// cleared row into an aisle; repartitionGroceryList owns that. The banner stays the server's call (0.7.3).
const applyUncheckAll = (list: GroceryList): GroceryList => repartitionGroceryList(list, uncheckRow)

export function buildUncheckAllGroceriesMutationOptions(
  queryClient: QueryClient,
  planId: string
): Omit<UseMutationOptions<UncheckAllGroceriesResult, Error, void, UncheckAllGroceriesContext>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.uncheckAllGroceries,
    onMutate: async () => {
      // A refetch already in flight would land after the optimistic write and erase it, so it is cancelled first.
      await queryClient.cancelQueries({queryKey: queryKeys.groceryList(planId)})

      const previousList = queryClient.getQueryData<GroceryList>(queryKeys.groceryList(planId))

      if (previousList !== undefined) {
        queryClient.setQueryData(queryKeys.groceryList(planId), applyUncheckAll(previousList))
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
