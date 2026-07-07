import {enrollCoach} from '@queries/api/coach/enrollCoach'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useEnrollCoachMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.enrollCoach,
    mutationFn: enrollCoach,
    onSuccess: state => {
      queryClient.setQueryData(queryKeys.coachState, state)
      // The plan generator rewrote users.target_* server-side
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacrosAll})
    }
  })
}
