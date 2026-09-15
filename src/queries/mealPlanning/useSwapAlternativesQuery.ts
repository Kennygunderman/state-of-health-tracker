import {fetchSwapAlternatives} from '@queries/api/mealPlanning/fetchSwapAlternatives'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// planRevision is part of the cache key only — the request itself carries no revision.
export const useSwapAlternativesQuery = (planId: string, mealId: string, planRevision: number) =>
  useQuery({
    queryKey: queryKeys.swapAlternatives(planId, mealId, planRevision),
    queryFn: () => fetchSwapAlternatives(planId, mealId)
  })
