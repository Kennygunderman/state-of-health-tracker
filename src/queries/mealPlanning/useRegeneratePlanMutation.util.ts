import type {MealPlan} from '@data/models/MealPlan'
import type {RegeneratePlanPayload} from '@data/models/PlanGenerationResult'
import type {QueryClient, UseMutationOptions} from '@tanstack/react-query'
import {isUnknownOutcome} from '@utility/ApiErrorUtility'

import {mutationKeys, queryKeys} from '../keys'

export function buildRegeneratePlanMutationOptions(
  queryClient: QueryClient
): Omit<UseMutationOptions<MealPlan, Error, RegeneratePlanPayload>, 'mutationFn'> {
  return {
    mutationKey: mutationKeys.regeneratePlan,
    // Only an unknown outcome is retried, and only once: the same key replayed after a lost response returns
    // the stored 201 verbatim, whereas a confirmed refusal (409, 422, or a 5xx carrying a recognised code)
    // would answer identically forever.
    retry: (failureCount, error) => failureCount < 1 && isUnknownOutcome(error),
    retryDelay: 1500,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanDayAll})
      queryClient.invalidateQueries({queryKey: queryKeys.groceryListAll})
      queryClient.invalidateQueries({queryKey: queryKeys.affectedMealsAll})
      queryClient.invalidateQueries({queryKey: queryKeys.swapAlternativesAll})
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanPreferences})
      // Removed, not invalidated: a preview computed against the superseded revision is meaningless rather
      // than merely stale, so refetching it would only reissue a request the server now refuses.
      queryClient.removeQueries({queryKey: queryKeys.swapPreviewAll})
    }
  }
}
