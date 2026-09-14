import {estimateMacros} from '@queries/api/macros/estimateMacros'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

// The estimate feeds the review UI and persists nothing (entries are logged
// via useLogMealEntryMutation) — but each call consumes one unit of the free
// daily AI quota, so the usage meter is refreshed.
export const useEstimateMacrosMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.estimateMacros,
    mutationFn: estimateMacros,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.aiUsage})
    }
  })
}
