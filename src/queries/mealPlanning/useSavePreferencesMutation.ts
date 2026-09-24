import {MealPlanPreferencesSaveResult} from '@data/models/MealPlanPreferences'
import {savePreferences, SaveMealPlanPreferencesRequest} from '@queries/api/mealPlanning/savePreferences'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSavePreferencesMutationOptions} from './useSavePreferencesMutation.util'

export const useSavePreferencesMutation = (): UseMutationResult<
  MealPlanPreferencesSaveResult,
  Error,
  SaveMealPlanPreferencesRequest
> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSavePreferencesMutationOptions(queryClient),
    mutationFn: savePreferences
  })
}
