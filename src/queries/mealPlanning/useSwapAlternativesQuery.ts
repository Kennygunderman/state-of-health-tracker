import {SwapAlternatives} from '@data/models/SwapAlternative'
import {fetchSwapAlternatives} from '@queries/api/mealPlanning/fetchSwapAlternatives'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// planRevision is cache identity only — the request carries no revision — so a day response whose revision
// differs from the route param refetches under a new key instead of reading the pre-swap list.
export const useSwapAlternativesQuery = (
  planId: string,
  mealId: string,
  planRevision: number
): UseQueryResult<SwapAlternatives, DefaultError> =>
  useQuery({
    queryKey: queryKeys.swapAlternatives(planId, mealId, planRevision),
    queryFn: () => fetchSwapAlternatives(planId, mealId)
  })
