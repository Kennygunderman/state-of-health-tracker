import {saveNutritionTargets} from '@queries/api/mealPlanning/saveNutritionTargets'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {buildSaveNutritionTargetsMutationOptions} from './useSaveNutritionTargetsMutation.util'

export const useSaveNutritionTargetsMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...buildSaveNutritionTargetsMutationOptions(queryClient),
    mutationFn: saveNutritionTargets
  })
}
