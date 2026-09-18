import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react'

import {View} from 'react-native'

import {
  DislikedFoodLabelIndex,
  DislikedFoodSummary,
  MealPlanPreferences,
  MealSchedule,
  MealTimeEntry,
  TargetRoute
} from '@data/models/MealPlanPreferences'

import styles from './index.styled'
import {
  answerBodySkipped as applyBodySkipped,
  applyAllergenSelection,
  applyBudgetAmount,
  applyLifecycleEvent,
  applyMealSchedule,
  applyNoBudgetPreference,
  beginDislikeStaging as beginStaging,
  clearStagedDislikes as clearStaging,
  commitDislikeStaging as commitStaging,
  completedSteps as completedDraftSteps,
  createEmptyDraft,
  discardDislikeStaging as discardStaging,
  discardStepEdits as applyStepDiscard,
  DislikeStaging,
  DislikeStagingDelta,
  isStepComplete as isDraftStepComplete,
  markStepSaved as applyStepSaved,
  MealPlanSetupDirty,
  MealPlanSetupDraft,
  MealPlanSetupDraftSlice,
  MealPlanSetupDraftState,
  MealPlanSetupLifecycleEvent,
  MealPlanSetupStep,
  removeStagedDislike as applyStagedRemoval,
  seedDraftFromPreferences,
  setDislikedFoodIds,
  setMealTime as applyMealTime,
  setStepFields as applyStepFields,
  stagedDislikes as selectStagedDislikes,
  stepsForRoute,
  toggleDislikedFood as applyDislikedFoodToggle,
  toggleStagedDislike as applyStagedToggle
} from './index.util'

// Every way the draft can change. It is a separate interface from the state below because its identity never
// changes: each action is a setState updater, so the object a consumer that only acts on the draft subscribes
// to is built once. That is what keeps a keystroke on the budget field from re-rendering the Macros navigator
// — which reads `resetDraft` and nothing else — and, with it, the whole stack of screens it declares.
export interface MealPlanSetupActions {
  seedFromPreferences: (preferences: MealPlanPreferences | null | undefined) => void
  setStepFields: (step: MealPlanSetupStep, fields: Partial<MealPlanSetupDraft>) => void
  // Skip on the About-you screen. It is the body step's other answer, so it is an action here
  // rather than a field the screen clears: no measurement in the draft says "the user skipped",
  // and the completeness rules need to be told that the step was answered.
  answerBodySkipped: () => void
  selectAllergen: (allergen: string) => void
  // Takes the whole food, not its id: the name it was chosen under is what the previous screen puts on its
  // chip, and for a food reached through search nothing else in the app can supply one.
  toggleDislikedFood: (food: DislikedFoodSummary) => void
  setDislikedFoods: (foodIds: string[]) => void
  beginDislikeStaging: () => void
  toggleStagedDislike: (food: DislikedFoodSummary) => void
  removeStagedDislike: (foodId: string) => void
  clearStagedDislikes: () => void
  commitDislikeStaging: () => void
  discardDislikeStaging: () => void
  selectMealSchedule: (schedule: MealSchedule) => void
  setMealTime: (slot: MealTimeEntry['slot'], time: string) => void
  setBudgetAmount: (amount: number | null) => void
  setNoBudgetPreference: (noBudgetPreference: boolean) => void
  markStepSaved: (step: MealPlanSetupStep) => void
  discardStepEdits: (step: MealPlanSetupStep) => void
  resetDraft: (event: MealPlanSetupLifecycleEvent) => void
}

export interface MealPlanSetupContextValue extends MealPlanSetupActions {
  draft: MealPlanSetupDraft
  dirty: MealPlanSetupDirty
  seeded: boolean
  dislikeLabels: DislikedFoodLabelIndex
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
//   - MacrosRoutesStack, which declares the routes inside this provider, resets it with
//     'flow_exited' whenever the Macros root regains focus. That is what actually clears a
//     completed or dismissed setup today: a generated plan and 'Not now' both end with no wizard
//     route left on the stack.
//   - 'setup_completed' and 'setup_dismissed' are the same clearing decision named for a screen
//     that prefers to clear in its own handler. No production call site passes either one: the
//     focus listener on the Macros root in MacrosRoutesStack.tsx reports 'flow_exited', and that
//     is the clearing path in use. They stay the API a screen should reach for rather than
//     inventing a clearing rule of its own, and clearing twice is a no-op.
//   - a change of account clears by unmounting, and the boundary is the signed-in uid rather than
//     the signed-in/signed-out flag: App.tsx gives the session tree the React key
//     `sessionCacheBindingFor(userId).sessionKey`, so signing out AND signing straight in as
//     somebody else both recreate this provider with an empty draft. The distinction matters
//     because the draft holds the answers to 'what do you weigh', 'how old are you' and 'what
//     can't you eat': an account change arrives as one uid replacing another with no signed-out
//     render in between, a store reset cannot reach mounted Context, and the flag alone would
//     leave those answers on screen for the incoming account — along with the navigation state
//     whose route params carry that account's plan, meal and recipe ids, which nothing inside this
//     tree could clear either. That remount is deliberately the whole mechanism: this provider
//     holds flow-scoped edits and reads no identity of its own, so it imports no store and
//     subscribes to no auth state. The account-change cases in
//     src/queries/__tests__/queryClient.test.ts and src/store/auth/__tests__/useAuthStore.test.ts
//     pin the key, the cache partition and the session cleanup the remount rests on, and this
//     folder's own util test pins what the draft a recreated provider starts from may hold.
//     useMealPlanStore.reset() in useAuthStore covers the meal-plan state that is not in this tree.
// A persisted step ('step_saved') deliberately keeps the draft. Resuming a half-finished setup is
// the server's job (meal_plan_preferences.setup_step), so nothing here is persisted and the only
// client state that outlives the session is useMealPlanStore.pendingIntents.
const MealPlanSetupActionsContext = createContext<MealPlanSetupActions | null>(null)

// The draft and the food-search visit that sits on top of it are published separately, because they change
// at different times and are read by different screens: staging a food on 06b must not re-render the step
// screens still mounted beneath it, and a keystroke on a step must not re-render 06b. Each value is rebuilt
// only when its own part of the state changes, so a consumer of one is not notified of the other.
const MealPlanSetupStateContext = createContext<MealPlanSetupDraftSlice | null>(null)

// null is a state this value genuinely has — no visit in flight — so the missing-provider case is undefined.
const DislikeStagingContext = createContext<DislikeStagingDelta | null | undefined>(undefined)

// For a consumer that changes the draft without reading it. It never re-renders.
export const useMealPlanSetupActions = (): MealPlanSetupActions => {
  const value = useContext(MealPlanSetupActionsContext)

  if (!value) {
    throw new Error('useMealPlanSetupActions must be used inside MealPlanSetupProvider')
  }

  return value
}

export const useMealPlanSetupDraft = (): MealPlanSetupContextValue => {
  const actions = useMealPlanSetupActions()
  const state = useContext(MealPlanSetupStateContext)

  if (!state) {
    throw new Error('useMealPlanSetupDraft must be used inside MealPlanSetupProvider')
  }

  // Both take the whole state, not the draft: a body step answered with Skip is recorded on the
  // state, because no editable field of the draft can hold it.
  const completedSteps = useCallback((route: TargetRoute) => completedDraftSteps(state, route), [state])

  const isStepComplete = useCallback((step: MealPlanSetupStep) => isDraftStepComplete(state, step), [state])

  return useMemo<MealPlanSetupContextValue>(
    () => ({
      ...actions,
      draft: state.draft,
      dirty: state.dirty,
      seeded: state.seeded,
      dislikeLabels: state.dislikeLabels,
      stepsForRoute,
      completedSteps,
      isStepComplete
    }),
    [actions, completedSteps, isStepComplete, state.dirty, state.dislikeLabels, state.draft, state.seeded]
  )
}

// What the food-search screen renders: the step's answer with the visit's difference applied. It reads the
// draft as well as the visit, because the answer underneath is what the difference is taken from.
export const useDislikeStaging = (): DislikeStaging => {
  const state = useContext(MealPlanSetupStateContext)
  const dislikeStaging = useContext(DislikeStagingContext)

  if (!state || dislikeStaging === undefined) {
    throw new Error('useDislikeStaging must be used inside MealPlanSetupProvider')
  }

  return useMemo(
    () => selectStagedDislikes({draft: state.draft, dislikeLabels: state.dislikeLabels, dislikeStaging}),
    [dislikeStaging, state.dislikeLabels, state.draft]
  )
}

export interface MealPlanStepEditControls {
  // Call once the step's save has succeeded, BEFORE navigating: it makes the draft values the stored ones,
  // so the discard on the way out has nothing to roll back. In setup mode there is no discard to disarm and
  // it does nothing, which is deliberate: the dirty flag it would clear is also what protects an answer
  // given while the preferences query was still in flight from the seed that resolves it.
  markSaved: () => void
  // Drop this step's unsaved edits now — what 'Use theirs' does after a revision conflict.
  discardEdits: () => void
}

// The header back button of a step opened in edit mode is Cancel (AAP 0.7.4), and a native-stack route has
// three more ways out that reach no handler: the iOS swipe, Android system back, and a pop performed by a
// parent. Discarding on the way out covers all of them with one rule. `discardOnLeave` is false in setup
// mode, where the in-flight answers are the point of the draft and the later steps derive from them.
export const useSetupStepEdit = (step: MealPlanSetupStep, discardOnLeave: boolean): MealPlanStepEditControls => {
  const {discardStepEdits, markStepSaved} = useMealPlanSetupActions()

  useEffect(() => {
    if (!discardOnLeave) {
      return undefined
    }

    return () => discardStepEdits(step)
  }, [discardOnLeave, discardStepEdits, step])

  const markSaved = useCallback(() => {
    if (discardOnLeave) {
      markStepSaved(step)
    }
  }, [discardOnLeave, markStepSaved, step])

  const discardEdits = useCallback(() => discardStepEdits(step), [discardStepEdits, step])

  return useMemo(() => ({markSaved, discardEdits}), [discardEdits, markSaved])
}

interface Props {
  children: React.ReactNode
}

const MealPlanSetupProvider = ({children}: Props): React.JSX.Element => {
  const [state, setState] = useState<MealPlanSetupDraftState>(createEmptyDraft)

  const seedFromPreferences = useCallback((preferences: MealPlanPreferences | null | undefined) => {
    setState(previous => seedDraftFromPreferences(preferences, previous))
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

  const toggleDislikedFood = useCallback((food: DislikedFoodSummary) => {
    setState(previous => applyDislikedFoodToggle(previous, food))
  }, [])

  const setDislikedFoods = useCallback((foodIds: string[]) => {
    setState(previous => setDislikedFoodIds(previous, foodIds))
  }, [])

  const beginDislikeStaging = useCallback(() => {
    setState(previous => beginStaging(previous))
  }, [])

  const toggleStagedDislike = useCallback((food: DislikedFoodSummary) => {
    setState(previous => applyStagedToggle(previous, food))
  }, [])

  const removeStagedDislike = useCallback((foodId: string) => {
    setState(previous => applyStagedRemoval(previous, foodId))
  }, [])

  const clearStagedDislikes = useCallback(() => {
    setState(previous => clearStaging(previous))
  }, [])

  const commitDislikeStaging = useCallback(() => {
    setState(previous => commitStaging(previous))
  }, [])

  const discardDislikeStaging = useCallback(() => {
    setState(previous => discardStaging(previous))
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

  const markStepSaved = useCallback((step: MealPlanSetupStep) => {
    setState(previous => applyStepSaved(previous, step))
  }, [])

  const discardStepEdits = useCallback((step: MealPlanSetupStep) => {
    setState(previous => applyStepDiscard(previous, step))
  }, [])

  const resetDraft = useCallback((event: MealPlanSetupLifecycleEvent) => {
    setState(previous => applyLifecycleEvent(previous, event))
  }, [])

  const actions = useMemo<MealPlanSetupActions>(
    () => ({
      seedFromPreferences,
      setStepFields,
      answerBodySkipped,
      selectAllergen,
      toggleDislikedFood,
      setDislikedFoods,
      beginDislikeStaging,
      toggleStagedDislike,
      removeStagedDislike,
      clearStagedDislikes,
      commitDislikeStaging,
      discardDislikeStaging,
      selectMealSchedule,
      setMealTime,
      setBudgetAmount,
      setNoBudgetPreference,
      markStepSaved,
      discardStepEdits,
      resetDraft
    }),
    [
      answerBodySkipped,
      beginDislikeStaging,
      clearStagedDislikes,
      commitDislikeStaging,
      discardDislikeStaging,
      discardStepEdits,
      markStepSaved,
      removeStagedDislike,
      resetDraft,
      seedFromPreferences,
      selectAllergen,
      selectMealSchedule,
      setBudgetAmount,
      setDislikedFoods,
      setMealTime,
      setNoBudgetPreference,
      setStepFields,
      toggleDislikedFood,
      toggleStagedDislike
    ]
  )

  const draftSlice = useMemo<MealPlanSetupDraftSlice>(
    () => ({
      draft: state.draft,
      dirty: state.dirty,
      seeded: state.seeded,
      bodyAnswered: state.bodyAnswered,
      dislikeLabels: state.dislikeLabels
    }),
    [state.bodyAnswered, state.dirty, state.dislikeLabels, state.draft, state.seeded]
  )

  return (
    <MealPlanSetupActionsContext.Provider value={actions}>
      <MealPlanSetupStateContext.Provider value={draftSlice}>
        <DislikeStagingContext.Provider value={state.dislikeStaging}>
          <View style={styles.root}>{children}</View>
        </DislikeStagingContext.Provider>
      </MealPlanSetupStateContext.Provider>
    </MealPlanSetupActionsContext.Provider>
  )
}

export default MealPlanSetupProvider
