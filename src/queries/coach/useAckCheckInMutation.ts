import {CoachState} from '@data/models/CoachState'
import {ackCheckIn} from '@queries/api/coach/ackCheckIn'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export const useAckCheckInMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.ackCheckIn,
    mutationFn: ackCheckIn,
    onSuccess: (_, planId) => {
      // Cheap local update — a full refetch would recompute the whole window
      // server-side just to flip one timestamp
      queryClient.setQueryData<CoachState>(queryKeys.coachState, current => {
        if (!current) return current

        const ackedAt = new Date().toISOString()

        return {
          ...current,
          activePlan:
            current.activePlan?.id === planId ? {...current.activePlan, acknowledgedAt: ackedAt} : current.activePlan,
          pendingCheckIn: current.pendingCheckIn?.id === planId ? null : current.pendingCheckIn
        }
      })
    }
  })
}
