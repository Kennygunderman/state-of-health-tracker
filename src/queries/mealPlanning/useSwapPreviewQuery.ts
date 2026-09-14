import {SwapPreview} from '@data/models/SwapAlternative'
import {fetchSwapPreview} from '@queries/api/mealPlanning/fetchSwapPreview'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// planRevision is cache identity only — the request carries no revision — and the decoded preview is returned
// untransformed, because `portionMultiplier` is sent back verbatim on commit (a mismatch is 409 preview_stale).
export const useSwapPreviewQuery = (
  planId: string,
  mealId: string,
  recipeVersionId: string,
  planRevision: number
): UseQueryResult<SwapPreview, DefaultError> =>
  useQuery({
    queryKey: queryKeys.swapPreview(planId, mealId, recipeVersionId, planRevision),
    queryFn: () => fetchSwapPreview(planId, mealId, recipeVersionId)
  })
