import {MealPlanPreferencesSaveResult} from '@data/models/MealPlanPreferences'
import {savePreferences, SaveMealPlanPreferencesRequest} from '@queries/api/mealPlanning/savePreferences'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSavePreferencesMutationOptions} from './useSavePreferencesMutation.util'

// The variables are the REQUEST type, not the payload: the full save's envelope requires `timeZone`
// (the server resolves the user's "today" from the zone the request carried), so a caller cannot build a
// body the server will refuse.
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
