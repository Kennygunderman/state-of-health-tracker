import type {GroceryItem, GroceryList, GrocerySection, ToggleGroceryItemResult} from '@data/models/GroceryList'
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

const countCheckedRows = (sections: GrocerySection[], checkedItems: GroceryItem[]): number =>
  sections.reduce((total, section) => total + section.items.filter(item => item.isChecked).length, 0) +
  checkedItems.filter(item => item.isChecked).length

const findAisleRow = (list: GroceryList, itemId: string): GroceryItem | undefined =>
  list.sections.flatMap(section => section.items).find(item => item.id === itemId)

// Checking follows the response's own partition and moves the row out of its aisle into the checked card, so
// the row the shopper just ticked is still on screen: GroceryList drops checked rows from the aisles.
// Unchecking restates the row where it sits, because GroceryItem carries no category (0.5.2) and inventing an
// aisle would be worse than the settle refetch re-filing it; no row ever leaves the cache.
const applyToggle = (list: GroceryList, itemId: string, isChecked: boolean): GroceryList => {
  const promotedRow = isChecked ? findAisleRow(list, itemId) : undefined

  const sections = list.sections.map(section => ({
    ...section,
    items:
      promotedRow === undefined
        ? section.items.map(item => toggleRow(item, itemId, isChecked))
        : section.items.filter(item => item.id !== itemId)
  }))

  const checkedItems =
    promotedRow === undefined
      ? list.checkedItems.map(item => toggleRow(item, itemId, isChecked))
      : [...list.checkedItems.filter(item => item.id !== itemId), toggleRow(promotedRow, itemId, isChecked)]

  return {...list, sections, checkedItems, checkedCount: countCheckedRows(sections, checkedItems)}
}

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
