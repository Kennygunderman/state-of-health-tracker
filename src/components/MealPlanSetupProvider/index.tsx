import React, {createContext, useCallback, useContext, useMemo, useState} from 'react'

import {MealPlanPreferences, MealSchedule, MealTimeEntry, TargetRoute} from '@data/models/MealPlanPreferences'

import {
  answerBodySkipped as applyBodySkipped,
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
  // Skip on the About-you screen. It is the body step's other answer, so it is an action here
  // rather than a field the screen clears: no measurement in the draft says "the user skipped",
  // and the completeness rules need to be told that the step was answered.
  answerBodySkipped: () => void
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
//   - a change of account clears by unmounting, and the boundary is the signed-in uid rather than
//     the signed-in/signed-out flag: App.tsx keys the whole session tree by that uid, so signing
//     out AND signing straight in as somebody else both recreate this provider with an empty
//     draft. The distinction matters because the draft holds the answers to 'what do you weigh',
//     'how old are you' and 'what can't you eat': an account change arrives as one uid replacing
//     another with no signed-out render in between, a store reset cannot reach mounted Context, and
//     the flag alone would leave those answers on screen for the incoming account.
//     useMealPlanStore.reset() in useAuthStore covers the meal-plan state that is not in this tree.
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

  const answerBodySkipped = useCallback(() => {
    setState(previous => applyBodySkipped(previous))
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

  // Both take the whole state, not the draft: a body step answered with Skip is recorded on the
  // state, because no editable field of the draft can hold it.
  const completedSteps = useCallback((route: TargetRoute) => completedDraftSteps(state, route), [state])

  const isStepComplete = useCallback((step: MealPlanSetupStep) => isDraftStepComplete(state, step), [state])

  const value = useMemo<MealPlanSetupContextValue>(
    () => ({
      draft: state.draft,
      dirty: state.dirty,
      seeded: state.seeded,
      seedFromPreferences,
      setStepFields,
      answerBodySkipped,
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
      answerBodySkipped,
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
