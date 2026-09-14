import {fetchRecipeDetail} from '@queries/api/mealPlanning/fetchRecipeDetail'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useRecipeDetailQuery = (recipeVersionId: string) =>
  useQuery({queryKey: queryKeys.recipeVersion(recipeVersionId), queryFn: () => fetchRecipeDetail(recipeVersionId)})
