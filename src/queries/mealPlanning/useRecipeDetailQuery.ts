import {RecipeVersion} from '@data/models/Recipe'
import {fetchRecipeDetail} from '@queries/api/mealPlanning/fetchRecipeDetail'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useRecipeDetailQuery = (recipeVersionId: string): UseQueryResult<RecipeVersion, DefaultError> =>
  useQuery({queryKey: queryKeys.recipeVersion(recipeVersionId), queryFn: () => fetchRecipeDetail(recipeVersionId)})
