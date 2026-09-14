import {fetchNutritionTargets} from '@queries/api/mealPlanning/fetchNutritionTargets'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// A null result means the server holds no targets — callers fall back to a local one, so never default it here.
export const useNutritionTargetsQuery = () =>
  useQuery({
    queryKey: queryKeys.nutritionTargets,
    queryFn: fetchNutritionTargets
  })
