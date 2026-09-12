import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildUpdateMealEntryMutationOptions} from './useUpdateMealEntryMutation.util'

export const useUpdateMealEntryMutation = (date: string) => {
  const queryClient = useQueryClient()

  return useMutation(buildUpdateMealEntryMutationOptions(queryClient, date))
}
