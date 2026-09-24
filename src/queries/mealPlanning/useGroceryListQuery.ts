import {GroceryList} from '@data/models/GroceryList'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {buildGroceryListQueryOptions} from './useGroceryListQuery.util'
import {useMealPlanGatedRequestAllowed} from './useMealPlanGatedRequestAllowed'

// planId is nullable because the grocery screen is reachable with no active plan: it renders 14c from a null
// id and issues no request. The capability verdict is read here rather than taken from the caller, so a
// latched session issues nothing even with a plan id in hand (AAP 0.2.5, 0.7.5).
export const useGroceryListQuery = (planId: string | null): UseQueryResult<GroceryList, DefaultError> => {
  const queryClient = useQueryClient()
  const isGatedReadAllowed = useMealPlanGatedRequestAllowed()

  return useQuery(buildGroceryListQueryOptions(queryClient, planId, isGatedReadAllowed))
}
