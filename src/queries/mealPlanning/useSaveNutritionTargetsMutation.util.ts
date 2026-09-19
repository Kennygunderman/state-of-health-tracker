import type {SaveNutritionTargetsPayload, SaveNutritionTargetsResult} from '@data/models/NutritionTargets'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

const applyNutritionTargetsSaveCacheEffects = (queryClient: QueryClient): void => {
  queryClient.invalidateQueries({queryKey: queryKeys.nutritionTargets})
  queryClient.invalidateQueries({queryKey: queryKeys.targetEstimate})
  // Diary and history read targets from the macros responses, so this must reach every cached day, not one date.
  queryClient.invalidateQueries({queryKey: queryKeys.dailyMacrosAll})
  queryClient.invalidateQueries({queryKey: queryKeys.macrosHistory})
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
  queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
  // Removed, not invalidated: a cached preview's ranking and deltas are bound to the targets it was built on.
  queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
}

export function buildSaveNutritionTargetsMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<SaveNutritionTargetsResult, Error, SaveNutritionTargetsPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.saveNutritionTargets,
    onSuccess: () => {
      applyNutritionTargetsSaveCacheEffects(queryClient)
    },
    // A rejected attempt owes the cache the same effects whenever the server may be holding the write.
    // `stale_targets` — this route's own revision-conflict code — is proof it moved past the draft's
    // `expectedTargetsRevision`, so the repeated save landed the first time and only its response was lost;
    // the screen's equality recovery then resolves silently (0.7.2) with no other chance to refresh the
    // targets, the estimate, the diary and history macros or the plan. An unknown outcome may equally have
    // committed before the response was lost (0.2.5). Every other confirmed code (`estimate_stale`,
    // `invalid_request`, whose `details[]` name the offending fields, …) means the server wrote
    // nothing, so it touches no cache.
    onError: error => {
      if (getApiErrorCode(error) === API_ERROR_CODES.staleTargets || isUnknownOutcome(error)) {
        applyNutritionTargetsSaveCacheEffects(queryClient)
      }
    }
  }
}
