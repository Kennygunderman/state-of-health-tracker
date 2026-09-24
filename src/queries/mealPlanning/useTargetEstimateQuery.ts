import {NutritionTargetEstimate} from '@data/models/NutritionTargets'
import {fetchTargetEstimate} from '@queries/api/mealPlanning/fetchTargetEstimate'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useTargetEstimateQuery = (): UseQueryResult<NutritionTargetEstimate, DefaultError> =>
  useQuery({
    queryKey: queryKeys.targetEstimate,
    queryFn: fetchTargetEstimate
  })
