import {GroceryList} from '@data/models/GroceryList'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {buildGroceryListQueryOptions} from './useGroceryListQuery.util'

// planId is nullable because the grocery screen is reachable with no active plan: it renders 14c from a null
// id and issues no request, which is also what keeps /meal-planning unread while the kill switch is off.
export const useGroceryListQuery = (planId: string | null): UseQueryResult<GroceryList, DefaultError> => {
  const queryClient = useQueryClient()

  return useQuery(buildGroceryListQueryOptions(queryClient, planId))
}
