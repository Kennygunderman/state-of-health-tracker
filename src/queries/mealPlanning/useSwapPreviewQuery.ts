import {fetchSwapPreview} from '@queries/api/mealPlanning/fetchSwapPreview'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// planRevision is cache identity only — the request carries none — so a preview never outlives its plan state
export const useSwapPreviewQuery = (planId: string, mealId: string, recipeVersionId: string, planRevision: number) =>
  useQuery({
    queryKey: queryKeys.swapPreview(planId, mealId, recipeVersionId, planRevision),
    queryFn: () => fetchSwapPreview(planId, mealId, recipeVersionId)
  })
