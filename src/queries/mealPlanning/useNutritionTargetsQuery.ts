import {NutritionTargets} from '@data/models/NutritionTargets'
import {fetchNutritionTargets} from '@queries/api/mealPlanning/fetchNutritionTargets'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// A null result means the server holds no targets — callers fall back to a local one, so never default it here.
// Deliberately ungated, unlike the preferences and current-plan queries: the server never gates
// /meal-planning/targets*, and Account, Progress and the Diary target editor read targets while planning is off.
export const useNutritionTargetsQuery = (): UseQueryResult<NutritionTargets | null, DefaultError> =>
  useQuery({
    queryKey: queryKeys.nutritionTargets,
    queryFn: fetchNutritionTargets
  })
