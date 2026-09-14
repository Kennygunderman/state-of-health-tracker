import type {GroceryItem, GroceryList, UncheckAllGroceriesResult} from '@data/models/GroceryList'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export interface UncheckAllGroceriesContext {
  previousList: GroceryList | undefined
}

const uncheckRow = (item: GroceryItem): GroceryItem => ({...item, isChecked: false, flag: null})

// Every tick clears at once, and the checked card keeps its rows rather than dropping them: GroceryItem
// carries no category (0.5.2), so only the settle refetch can re-file them under their aisles, and removing
// them here would take groceries off the shopper's list until it lands.
const applyUncheckAll = (list: GroceryList): GroceryList => ({
  ...list,
  sections: list.sections.map(section => ({...section, items: section.items.map(uncheckRow)})),
  checkedItems: list.checkedItems.map(uncheckRow),
  checkedCount: 0
})

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
