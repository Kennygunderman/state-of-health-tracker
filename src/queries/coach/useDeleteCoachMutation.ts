import {deleteCoach} from '@queries/api/coach/deleteCoach'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useDeleteCoachMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.deleteCoach,
    mutationFn: deleteCoach,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.coachState})
    }
  })
}
