import {fetchTargetEstimate} from '@queries/api/mealPlanning/fetchTargetEstimate'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useTargetEstimateQuery = () =>
  useQuery({
    queryKey: queryKeys.targetEstimate,
    queryFn: fetchTargetEstimate
  })
