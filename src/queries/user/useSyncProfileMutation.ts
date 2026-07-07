import {updateProfile} from '@queries/api/user/updateProfile'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useSyncProfileMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.syncProfile,
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.coachState})
    }
  })
}
