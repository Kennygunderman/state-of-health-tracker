import {SaveNutritionTargetsPayload, SaveNutritionTargetsResult} from '@data/models/NutritionTargets'
import {saveNutritionTargets} from '@queries/api/mealPlanning/saveNutritionTargets'
import {useMutation, UseMutationResult, useQueryClient} from '@tanstack/react-query'

import {buildSaveNutritionTargetsMutationOptions} from './useSaveNutritionTargetsMutation.util'

export const useSaveNutritionTargetsMutation = (): UseMutationResult<
  SaveNutritionTargetsResult,
  Error,
  SaveNutritionTargetsPayload
> => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSaveNutritionTargetsMutationOptions(queryClient),
    mutationFn: saveNutritionTargets
  })
}
