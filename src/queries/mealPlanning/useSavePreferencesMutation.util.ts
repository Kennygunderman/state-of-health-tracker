import type {MealPlanPreferencesSaveResult, SaveMealPlanPreferencesPayload} from '@data/models/MealPlanPreferences'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

const applyPreferencesSaveCacheEffects = (queryClient: QueryClient): void => {
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
  queryClient.invalidateQueries({queryKey: queryKeys.targetEstimate})
  queryClient.invalidateQueries({queryKey: queryKeys.nutritionTargets})
  queryClient.invalidateQueries({queryKey: queryKeys.affectedMealsAll})
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
  queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
  // Removed, not invalidated: a cached preview is bound to the preferences it was computed against.
  queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
}

export function buildSavePreferencesMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<MealPlanPreferencesSaveResult, Error, SaveMealPlanPreferencesPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.savePreferences,
    onSuccess: () => {
      applyPreferencesSaveCacheEffects(queryClient)
    },
    // A rejected attempt owes the cache the same effects whenever the server may be holding the write.
    // `stale_revision` is proof it moved past the draft's `expectedRevision` — the repeated save landed the
    // first time and only its response was lost — and the screen's equality recovery then resolves silently
    // (0.7.2), with no other chance to refresh what the write changed. An unknown outcome may equally have
    // committed before the response was lost (0.2.5). Every other confirmed code (`invalid_request`,
    // whose `details[]` name the offending fields, `feature_disabled`, …) means the server wrote
    // nothing, so it touches no cache.
    onError: error => {
      if (getApiErrorCode(error) === API_ERROR_CODES.staleRevision || isUnknownOutcome(error)) {
        applyPreferencesSaveCacheEffects(queryClient)
      }
    }
  }
}
