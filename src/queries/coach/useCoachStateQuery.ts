import {fetchCoachState} from '@queries/api/coach/fetchCoachState'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useCoachStateQuery = () =>
  useQuery({
    queryKey: queryKeys.coachState,
    queryFn: fetchCoachState
  })
