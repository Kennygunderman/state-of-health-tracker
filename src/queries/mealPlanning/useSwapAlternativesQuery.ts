import {SwapAlternatives} from '@data/models/SwapAlternative'
import {fetchSwapAlternatives} from '@queries/api/mealPlanning/fetchSwapAlternatives'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {useMealPlanGatedRequestAllowed} from './useMealPlanGatedRequestAllowed'

// planRevision is part of the cache key only — the request itself carries no revision.
//
// The capability gate is read here rather than passed in: this is a gated route, and the swap screen that
// mounts it can be reached with the session verdict already refused (AAP 0.2.5, 0.7.5).
export const useSwapAlternativesQuery = (
  planId: string,
  mealId: string,
  planRevision: number
): UseQueryResult<SwapAlternatives, DefaultError> => {
  const isGatedReadAllowed = useMealPlanGatedRequestAllowed()

  return useQuery({
    queryKey: queryKeys.swapAlternatives(planId, mealId, planRevision),
    queryFn: () => fetchSwapAlternatives(planId, mealId),
    enabled: isGatedReadAllowed
  })
}
