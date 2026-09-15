import {MealPlanPreferencesSaveResult, SetupStepRequest} from '@data/models/MealPlanPreferences'
import {saveSetupStep} from '@queries/api/mealPlanning/saveSetupStep'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSaveSetupStepMutationOptions} from './useSaveSetupStepMutation.util'

export const useSaveSetupStepMutation = (): UseMutationResult<
  MealPlanPreferencesSaveResult,
  Error,
  SetupStepRequest
> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSaveSetupStepMutationOptions(queryClient),
    mutationFn: saveSetupStep
  })
}
