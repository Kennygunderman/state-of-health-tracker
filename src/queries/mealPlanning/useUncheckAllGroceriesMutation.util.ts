import type {GroceryItem, GroceryList, UncheckAllGroceriesResult} from '@data/models/GroceryList'
import {repartitionGroceryList} from '@data/models/GroceryList'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export interface UncheckAllGroceriesContext {
  previousList: GroceryList | undefined
}

/**
 * Clears a row's tick and flag — unless doing so would have to invent the aisle it goes back to.
 *
 * A cleared row leaves the checked card for an aisle, and a row whose aisle the client has never seen has
 * only the `pantry_other` catch-all to land in: that would put Produce and Protein rows under "Pantry & other"
 * in front of the shopper until the settle refetch re-files them, stating something false about the store
 * layout. Keeping the tick instead states nothing false — the row stays exactly where the shopper last saw it,
 * at the pending opacity this screen already renders it at (0.7.2), and the settle refetch clears it, which is
 * the only answer that can name its aisle: the response carries `category` per section and holds the checked
 * rows out of the sections (0.5.2). It cannot hide a finished clear either, because the server owns
 * `checkedCount` and that refetch always runs.
 *
 * The retained rows cannot fake an empty list: the empty-list state needs `totalCount === 0` and no rows at
 * all, and these rows are still rows in a list whose total the server states.
 *
 * `retainKnownAisles` keeps the aisle across refetches, so by the time a shopper can press "Uncheck all" the
 * declined case is only a row this device has never seen inside a section. `repartitionGroceryList` keeps its
 * `UNFILED_AISLE` last resort for the single-row toggle path, where the shopper is unticking the one row they
 * are looking at and losing it from the list would be worse than an honest "everything else" heading.
 */
const uncheckRow = (item: GroceryItem): GroceryItem => {
  if (item.isChecked && item.category === undefined) {
    return item
  }

  return item.isChecked || item.flag !== null ? {...item, isChecked: false, flag: null} : item
}

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
