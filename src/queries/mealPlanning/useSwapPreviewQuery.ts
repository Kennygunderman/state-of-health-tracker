import {SwapPreview} from '@data/models/SwapAlternative'
import {fetchSwapPreview} from '@queries/api/mealPlanning/fetchSwapPreview'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// planRevision is cache identity only — the request carries none — so a preview never outlives its plan state.
//
// enabled exists for the same reason it does on the day and current-plan reads: a caller may need to OBSERVE the
// preview without being in a position to request one. Recipe detail is that caller — it renders the candidate's
// portion and nutrition in its preview context and nothing of the kind in its plan context — and observing is
// what makes the entry recoverable: a screen that only sampled the cache saw nothing when the entry had been
// evicted, and had no refetch to offer. It defaults to true, so the swap preview calls this hook with four
// arguments.
export const useSwapPreviewQuery = (
  planId: string,
  mealId: string,
  recipeVersionId: string,
  planRevision: number,
  enabled = true
): UseQueryResult<SwapPreview, DefaultError> =>
  useQuery({
    queryKey: queryKeys.swapPreview(planId, mealId, recipeVersionId, planRevision),
    queryFn: () => fetchSwapPreview(planId, mealId, recipeVersionId),
    enabled
  })
