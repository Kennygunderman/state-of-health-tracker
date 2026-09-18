import {useCallback} from 'react'

import {useQueryClient} from '@tanstack/react-query'

import {refetchCurrentMealPlan} from './useCurrentMealPlanQuery.util'

/**
 * The intent-level recovery a caller asks for when the plan it holds stops being the plan — a plan route that
 * contradicted it, or a verdict that refused writes on it. The callback owns re-reading the current plan; the
 * screen keeps the toast and the navigation that go with it, and never names the cache entry itself (the key
 * stays declared once, in `queries/keys.ts`, and is reached only through `useCurrentMealPlanQuery.util`).
 *
 * It deliberately calls no `useQuery`, so asking for the recovery mounts no observer: a screen that never
 * renders the current plan (RecipeDetail, behind every stacked route) would otherwise hold
 * `/plans/current` live — and issue that kill-switch-gated request — for a recovery that rarely fires.
 *
 * `useCallback` is load-bearing, not hygiene: the callback is read from an effect that lists it as a
 * dependency, so a fresh identity per render would re-fire that effect's toast and refetch on every render.
 */
export const useCurrentMealPlanRecovery = (): (() => void) => {
  const queryClient = useQueryClient()

  return useCallback((): void => {
    refetchCurrentMealPlan(queryClient)
  }, [queryClient])
}
