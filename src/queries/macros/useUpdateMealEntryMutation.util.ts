import {MealEntry, UpdateMealEntryPayload} from '@data/models/MealEntry'
import {updateMealEntry} from '@queries/api/macros/updateMealEntry'
import {DefaultError, QueryClient, UseMutationOptions} from '@tanstack/react-query'

import {mutationKeys, queryKeys} from '../keys'

// A planned meal's logged state is derived live from the meal entries still linked to it, so editing the
// diary entry moves the plan with it: a servings change restates the slot's consumed totals, and a name or
// macro change detaches the entry server-side. Without the meal-plan invalidations the Meal Plan tab keeps
// rendering the pre-edit LOGGED badge and logged-entry count.
export function buildUpdateMealEntryMutationOptions(
  queryClient: QueryClient,
  date: string
): UseMutationOptions<MealEntry, DefaultError, {entryId: string; payload: UpdateMealEntryPayload}> {
  return {
    mutationKey: mutationKeys.updateMealEntry,
    mutationFn: ({entryId, payload}) => updateMealEntry(entryId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.dailyMacros(date)})
      queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
    }
  }
}
