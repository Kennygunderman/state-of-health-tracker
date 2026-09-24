import {LogCatalogMealEntryPayload, LogMealEntryPayload, MealEntry} from '@data/models/MealEntry'
import {logMealEntry} from '@queries/api/macros/logMealEntry'
import {DefaultError, useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

export interface LogMealEntryVariables {
  mealId: string
  payload: LogMealEntryPayload | LogCatalogMealEntryPayload
}

export const useLogMealEntryMutation = (
  date: string
): UseMutationResult<MealEntry, DefaultError, LogMealEntryVariables> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.logMealEntry,
    mutationFn: ({mealId, payload}: LogMealEntryVariables) => logMealEntry(mealId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacros(date)})
      queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
    }
  })
}
