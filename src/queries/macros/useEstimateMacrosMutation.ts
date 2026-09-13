import {EstimateMacrosPayload, MacroEstimate} from '@data/models/MacroEstimate'
import {estimateMacros} from '@queries/api/macros/estimateMacros'
import {DefaultError, useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

// The estimate feeds the review UI and persists nothing (entries are logged
// via useLogMealEntryMutation) — but each call consumes one unit of the free
// daily AI quota, so the usage meter is refreshed.
export const useEstimateMacrosMutation = (): UseMutationResult<MacroEstimate, DefaultError, EstimateMacrosPayload> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.estimateMacros,
    mutationFn: estimateMacros,
    // One intent, one paid call. The server consumes the quota unit before it
    // calls the model, so an automatic retry would charge a second unit for a
    // single user action — and a request this app abandons at
    // HTTP_REQUEST_TIMEOUT_MS may well have been answered. Retrying is the
    // user's decision, taken on a screen showing the meter below.
    retry: 0,
    // onSettled, not onSuccess: the quota is spent before the estimate exists,
    // so a failed, timed-out or abandoned estimate has already been charged.
    // Refreshing only on success would leave the "X of 5 left today" meter
    // reading one too many after every failure, inviting exactly the blind
    // retry that spends the next unit.
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.aiUsage})
    }
  })
}
