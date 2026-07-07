import {updateCoachSettings} from '@queries/api/coach/updateCoachSettings'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useUpdateCoachSettingsMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateCoachSettings,
    mutationFn: updateCoachSettings,
    onSuccess: state => {
      queryClient.setQueryData(queryKeys.coachState, state)
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacrosAll})
    }
  })
}
