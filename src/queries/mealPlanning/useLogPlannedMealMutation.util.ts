import type {LogPlannedMealPayload, LogPlannedMealResult} from '@queries/api/mealPlanning/logPlannedMeal'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export function buildLogPlannedMealMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<LogPlannedMealResult, Error, LogPlannedMealPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.logPlannedMeal,
    // Retried once and only for an unknown outcome: the variables' idempotencyKey replays a committed attempt.
    retry: (failureCount, error) => failureCount < 1 && isUnknownOutcome(error),
    retryDelay: 1500,
    onSuccess: (_data, variables) => {
      // The date comes from the variables, not a closure: the log screen's stepper moves it between presses.
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacros(variables.date)})
      queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
    }
  }
}
