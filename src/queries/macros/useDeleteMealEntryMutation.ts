import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildDeleteMealEntryMutationOptions} from './useDeleteMealEntryMutation.util'

export const useDeleteMealEntryMutation = (date: string) => {
  const queryClient = useQueryClient()

  return useMutation(buildDeleteMealEntryMutationOptions(queryClient, date))
}
