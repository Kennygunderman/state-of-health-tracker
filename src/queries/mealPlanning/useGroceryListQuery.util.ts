import {GroceryList, retainKnownAisles} from '@data/models/GroceryList'
import {fetchGroceryList} from '@queries/api/mealPlanning/fetchGroceryList'
import {QueryClient, UndefinedInitialDataOptions} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// A null planId is the no-plan state: the caller renders 14c and no request may be issued, so the options
// still need a well-formed key. '' types the factory call and is never fetched, because enabled is false.
const NO_PLAN_KEY = ''

/**
 * Builds the grocery-list read. Extracted from the hook so the aisle retention below is exercised without a
 * renderer, the way every other meal-planning read is built and tested.
 */
export const buildGroceryListQueryOptions = (
  queryClient: QueryClient,
  planId: string | null
): UndefinedInitialDataOptions<GroceryList> => {
  const key = planId ?? NO_PLAN_KEY

  return {
    queryKey: queryKeys.groceryList(key),
    // Every answer names the aisle per section and holds the checked rows out of the sections (0.5.2), so a
    // row that arrives already checked carries no aisle — including on the refetch that follows the shopper
    // ticking it. retainKnownAisles stamps the answer from the list the cache already holds, and it has to
    // happen here rather than in a selector because the optimistic grocery writes read the cache entry, not
    // this hook's result: an aisle known only to the render would leave `onMutate` guessing again. The cache
    // is read before the request is awaited so the identity retained is the one behind the list the shopper
    // was looking at when the read started.
    queryFn: async () => {
      const cachedList = queryClient.getQueryData<GroceryList>(queryKeys.groceryList(key))

      return retainKnownAisles(await fetchGroceryList(key), cachedList)
    },
    enabled: planId !== null
  }
}
