import {DefaultError, useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildDeleteMealEntryMutationOptions} from './useDeleteMealEntryMutation.util'

export const useDeleteMealEntryMutation = (date: string): UseMutationResult<void, DefaultError, string> => {
  const queryClient = useQueryClient()

  return useMutation(buildDeleteMealEntryMutationOptions(queryClient, date))
}
