import React, {createContext, useCallback, useContext, useMemo, useState} from 'react'

import {MealPlanPreferences, MealSchedule, MealTimeEntry, TargetRoute} from '@data/models/MealPlanPreferences'

import {
  applyAllergenSelection,
  applyBudgetAmount,
  applyLifecycleEvent,
  applyMealSchedule,
  applyNoBudgetPreference,
  completedSteps as completedDraftSteps,
  createEmptyDraft,
  isStepComplete as isDraftStepComplete,
  MealPlanSetupDirty,
  MealPlanSetupDraft,
  MealPlanSetupDraftState,
  MealPlanSetupLifecycleEvent,
  MealPlanSetupStep,
  seedDraftFromPreferences,
  setDislikedFoodIds,
  setMealTime as applyMealTime,
  setStepFields as applyStepFields,
  stepsForRoute,
  toggleDislikedFoodId
} from './index.util'

export interface MealPlanSetupContextValue {
  draft: MealPlanSetupDraft
  dirty: MealPlanSetupDirty
  seeded: boolean
  seedFromPreferences: (preferences: MealPlanPreferences | null | undefined) => void
  setStepFields: (step: MealPlanSetupStep, fields: Partial<MealPlanSetupDraft>) => void
  selectAllergen: (allergen: string) => void
  toggleDislikedFood: (foodId: string) => void
  setDislikedFoods: (foodIds: string[]) => void
  selectMealSchedule: (schedule: MealSchedule) => void
  setMealTime: (slot: MealTimeEntry['slot'], time: string) => void
  setBudgetAmount: (amount: number | null) => void
  setNoBudgetPreference: (noBudgetPreference: boolean) => void
  resetDraft: (event: MealPlanSetupLifecycleEvent) => void
  stepsForRoute: (route: TargetRoute) => MealPlanSetupStep[]
  completedSteps: (route: TargetRoute) => MealPlanSetupStep[]
  isStepComplete: (step: MealPlanSetupStep) => boolean
}

// Every other piece of shared state in this app is a Zustand store; the wizard draft is the
// exception because it is flow-scoped in-flight edits rather than server or device state. Its
// lifetime is the whole Macros tab rather than one wizard screen: the provider is mounted around
// MacrosStack's navigator, because the seven steps are separate routes and a provider on one of
// them would drop every answer at the next Continue. Nothing about leaving a step screen unmounts
// it, so clearing the draft is an explicit act, wired in three places:
//   - MacrosStack resets it with 'flow_exited' whenever the Macros root regains focus. That is
//     what actually clears a completed or dismissed setup today: a generated plan and 'Not now'
//     both end with no wizard route left on the stack.
//   - 'setup_completed' and 'setup_dismissed' are the same clearing decision named for a screen
//     that prefers to clear in its own handler. No setup screen exists in the tree yet, so no
//     call site uses them; they are the API those screens should reach for rather than inventing
//     a clearing rule, and clearing twice is a no-op.
//   - signing out clears by unmounting: App.tsx swaps the whole navigator when the auth state
//     flips, so this tree goes with it, and useMealPlanStore.reset() in useAuthStore covers the
//     meal-plan state that is not in this tree.
// A persisted step ('step_saved') deliberately keeps the draft. Resuming a half-finished setup is
// the server's job (meal_plan_preferences.setup_step), so nothing here is persisted and the only
// client state that outlives the session is useMealPlanStore.pendingIntents.
const MealPlanSetupContext = createContext<MealPlanSetupContextValue | null>(null)

export const useMealPlanSetupDraft = (): MealPlanSetupContextValue => {
  const value = useContext(MealPlanSetupContext)

  if (!value) {
    throw new Error('useMealPlanSetupDraft must be used inside MealPlanSetupProvider')
  }

  return value
}

interface Props {
  children: React.ReactNode
}

const MealPlanSetupProvider = ({children}: Props): React.JSX.Element => {
  const [state, setState] = useState<MealPlanSetupDraftState>(createEmptyDraft)

  const seedFromPreferences = useCallback((preferences: MealPlanPreferences | null | undefined) => {
    setState(seedDraftFromPreferences(preferences))
  }, [])

  const setStepFields = useCallback((step: MealPlanSetupStep, fields: Partial<MealPlanSetupDraft>) => {
    setState(previous => applyStepFields(previous, step, fields))
  }, [])

  const selectAllergen = useCallback((allergen: string) => {
    setState(previous => applyAllergenSelection(previous, allergen))
  }, [])

  const toggleDislikedFood = useCallback((foodId: string) => {
    setState(previous => toggleDislikedFoodId(previous, foodId))
  }, [])

  const setDislikedFoods = useCallback((foodIds: string[]) => {
    setState(previous => setDislikedFoodIds(previous, foodIds))
  }, [])

  const selectMealSchedule = useCallback((schedule: MealSchedule) => {
    setState(previous => applyMealSchedule(previous, schedule))
  }, [])

  const setMealTime = useCallback((slot: MealTimeEntry['slot'], time: string) => {
    setState(previous => applyMealTime(previous, slot, time))
  }, [])

  const setBudgetAmount = useCallback((amount: number | null) => {
    setState(previous => applyBudgetAmount(previous, amount))
  }, [])

  const setNoBudgetPreference = useCallback((noBudgetPreference: boolean) => {
    setState(previous => applyNoBudgetPreference(previous, noBudgetPreference))
  }, [])

  const resetDraft = useCallback((event: MealPlanSetupLifecycleEvent) => {
    setState(previous => applyLifecycleEvent(previous, event))
  }, [])

  const completedSteps = useCallback((route: TargetRoute) => completedDraftSteps(state.draft, route), [state.draft])

  const isStepComplete = useCallback((step: MealPlanSetupStep) => isDraftStepComplete(state.draft, step), [state.draft])

  const value = useMemo<MealPlanSetupContextValue>(
    () => ({
      draft: state.draft,
      dirty: state.dirty,
      seeded: state.seeded,
      seedFromPreferences,
      setStepFields,
      selectAllergen,
      toggleDislikedFood,
      setDislikedFoods,
      selectMealSchedule,
      setMealTime,
      setBudgetAmount,
      setNoBudgetPreference,
      resetDraft,
      stepsForRoute,
      completedSteps,
      isStepComplete
    }),
    [
      completedSteps,
      isStepComplete,
      resetDraft,
      seedFromPreferences,
      selectAllergen,
      selectMealSchedule,
      setBudgetAmount,
      setDislikedFoods,
      setMealTime,
      setNoBudgetPreference,
      setStepFields,
      state.dirty,
      state.draft,
      state.seeded,
      toggleDislikedFood
    ]
  )

  return <MealPlanSetupContext.Provider value={value}>{children}</MealPlanSetupContext.Provider>
}

export default MealPlanSetupProvider
