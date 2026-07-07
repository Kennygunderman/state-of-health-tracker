import {updateMacroTargets} from '@queries/api/macros/updateMacroTargets'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useUpdateMacroTargetsMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateMacroTargets,
    mutationFn: updateMacroTargets,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacrosAll})
      queryClient.invalidateQueries({queryKey: queryKeys.coachState})
    }
  })
}
