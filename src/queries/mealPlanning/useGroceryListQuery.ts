import {GroceryList} from '@data/models/GroceryList'
import {fetchGroceryList} from '@queries/api/mealPlanning/fetchGroceryList'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useGroceryListQuery = (planId: string | null): UseQueryResult<GroceryList, DefaultError> => {
  // A null planId is the no-plan state: enabled is false, so this '' key types the factory call but never fetches
  const key = planId ?? ''

  return useQuery({
    queryKey: queryKeys.groceryList(key),
    queryFn: () => fetchGroceryList(key),
    enabled: planId !== null
  })
}
