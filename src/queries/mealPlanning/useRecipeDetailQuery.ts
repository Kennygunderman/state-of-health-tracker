import {RecipeVersion} from '@data/models/Recipe'
import {fetchRecipeDetail} from '@queries/api/mealPlanning/fetchRecipeDetail'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {useMealPlanGatedRequestAllowed} from './useMealPlanGatedRequestAllowed'

// `/recipes/*` is gated by the server kill switch alongside `/meal-planning/*` (AAP 0.3.1), so this read takes
// the capability verdict like every other gated one. It reads the verdict itself because recipe detail is the
// one gated screen that mounts no capability guard of its own, and a call site cannot pass what it never read.
export const useRecipeDetailQuery = (recipeVersionId: string): UseQueryResult<RecipeVersion, DefaultError> => {
  const isGatedReadAllowed = useMealPlanGatedRequestAllowed()

  return useQuery({
    queryKey: queryKeys.recipeVersion(recipeVersionId),
    queryFn: () => fetchRecipeDetail(recipeVersionId),
    enabled: isGatedReadAllowed
  })
}
