import {MealEntry, UpdateMealEntryPayload} from '@data/models/MealEntry'
import {DefaultError, useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildUpdateMealEntryMutationOptions} from './useUpdateMealEntryMutation.util'

export const useUpdateMealEntryMutation = (
  date: string
): UseMutationResult<MealEntry, DefaultError, {entryId: string; payload: UpdateMealEntryPayload}> => {
  const queryClient = useQueryClient()

  return useMutation(buildUpdateMealEntryMutationOptions(queryClient, date))
}
