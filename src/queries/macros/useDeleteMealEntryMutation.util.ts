import {deleteMealEntry} from '@queries/api/macros/deleteMealEntry'
import {DefaultError, QueryClient, UseMutationOptions} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

// A planned meal's logged state is derived live from the meal entries still linked to it, so removing the
// diary entry is what un-logs the plan slot — without the meal-plan invalidations the Meal Plan tab keeps
// showing the LOGGED badge and a logged-entry count for an entry that no longer exists.
export function buildDeleteMealEntryMutationOptions(
  queryClient: QueryClient,
  date: string
): UseMutationOptions<void, DefaultError, string> {
  return {
    mutationKey: mutationKeys.deleteMealEntry,
    mutationFn: (entryId: string) => deleteMealEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacros(date)})
      queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
    }
  }
}
