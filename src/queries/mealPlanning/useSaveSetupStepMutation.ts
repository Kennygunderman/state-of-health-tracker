import {MealPlanPreferencesSaveResult, SetupStep, SetupStepPayload} from '@data/models/MealPlanPreferences'
import {saveSetupStep} from '@queries/api/mealPlanning/saveSetupStep'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSaveSetupStepMutationOptions} from './useSaveSetupStepMutation.util'

export const useSaveSetupStepMutation = (): UseMutationResult<
  MealPlanPreferencesSaveResult,
  Error,
  {step: SetupStep; payload: SetupStepPayload}
> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSaveSetupStepMutationOptions(queryClient),
    mutationFn: ({step, payload}: {step: SetupStep; payload: SetupStepPayload}) => saveSetupStep(step, payload)
  })
}
