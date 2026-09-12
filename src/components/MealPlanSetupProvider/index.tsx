import React, {createContext, useCallback, useContext, useMemo, useState} from 'react'

import {MealPlanPreferences, MealSchedule, MealTimeEntry, TargetRoute} from '@data/models/MealPlanPreferences'

import {
  applyAllergenSelection,
  applyBudgetAmount,
  applyMealSchedule,
  applyNoBudgetPreference,
  completedSteps as completedDraftSteps,
  createEmptyDraft,
  isStepComplete as isDraftStepComplete,
  MealPlanSetupDirty,
  MealPlanSetupDraft,
  MealPlanSetupDraftState,
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
  seedFromPreferences: (preferences: MealPlanPreferences | null | undefined) => void
  setStepFields: (step: MealPlanSetupStep, fields: Partial<MealPlanSetupDraft>) => void
  selectAllergen: (allergen: string) => void
  toggleDislikedFood: (foodId: string) => void
  setDislikedFoods: (foodIds: string[]) => void
  selectMealSchedule: (schedule: MealSchedule) => void
  setMealTime: (slot: MealTimeEntry['slot'], time: string) => void
  setBudgetAmount: (amount: number | null) => void
  setNoBudgetPreference: (noBudgetPreference: boolean) => void
  resetDraft: () => void
  stepsForRoute: (route: TargetRoute) => MealPlanSetupStep[]
  completedSteps: (route: TargetRoute) => MealPlanSetupStep[]
  isStepComplete: (step: MealPlanSetupStep) => boolean
}

// Every other piece of shared state in this app is a Zustand store; the wizard draft is the
// exception because its lifetime is the Macros stack subtree — it dies with the flow rather than
// needing a manual reset(). Resuming a half-finished setup is the server's job (setup_step), and
// the only client state that outlives the session is useMealPlanStore.pendingIntents.
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

  const resetDraft = useCallback(() => {
    setState(createEmptyDraft())
  }, [])

  const completedSteps = useCallback((route: TargetRoute) => completedDraftSteps(state.draft, route), [state.draft])

  const isStepComplete = useCallback((step: MealPlanSetupStep) => isDraftStepComplete(state.draft, step), [state.draft])

  const value = useMemo<MealPlanSetupContextValue>(
    () => ({
      draft: state.draft,
      dirty: state.dirty,
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
      toggleDislikedFood
    ]
  )

  return <MealPlanSetupContext.Provider value={value}>{children}</MealPlanSetupContext.Provider>
}

export default MealPlanSetupProvider
