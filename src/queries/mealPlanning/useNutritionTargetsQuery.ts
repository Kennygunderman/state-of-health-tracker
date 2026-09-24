import {NutritionTargets} from '@data/models/NutritionTargets'
import {fetchNutritionTargets} from '@queries/api/mealPlanning/fetchNutritionTargets'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'
import {isRoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import {queryKeys} from '../keys'

// Absent data means the server holds no targets and callers fall back to a local one, so never default it
// here; `useNutritionTargetsQuery.util::selectNutritionTargets` is how a consumer reads that fallback. A
// route-missing answer arrives as an error rather than as data — it is the rolled-back-backend capability
// signal the entitlement reads (AAP 0.2.5) — and selects the same fallback, because absent data is absent
// data whatever kept it away.
//
// Deliberately ungated, unlike the preferences and current-plan queries: the server never gates
// /meal-planning/targets*, and Account, Progress and the Diary target editor read targets while planning is off.
export const useNutritionTargetsQuery = (): UseQueryResult<NutritionTargets, DefaultError> =>
  useQuery({
    queryKey: queryKeys.nutritionTargets,
    queryFn: fetchNutritionTargets,
    // The client default is `retry: 1`. A route that is not mounted answers a second attempt identically, so
    // that retry is pure waste for the one error this read classifies itself; everything else keeps the
    // default's single retry.
    retry: (failureCount, error) => failureCount < 1 && !isRoutesMissingError(error)
  })
