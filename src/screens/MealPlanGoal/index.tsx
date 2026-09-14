import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {View} from 'react-native'

import type {Goal, MealPlanPreferences, PaceLbPerWeek, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import type {StepMode} from '@navigation/types'
import {MealPlanGoalRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import Spacing from '@styles/spacing'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {kilogramsToPounds, weightUnitPrefFor} from '@utility/UnitConversionUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
import SetupFooter from '@components/SetupFooter'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  GOAL_WEIGHT_MODAL_ERROR,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_GOAL_TITLE,
  MEAL_PLAN_GOAL_WEIGHT_HEADER,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_OPTIONAL_LABEL,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_PACE_HEADER,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import PaceCards from './components/PaceCards'
import styles from './index.styled'
import {
  isGoalWeightVisible,
  isPaceVisible,
  MealPlanGoalErrorCode,
  paceOptionsForGoal,
  parseGoalWeightInput,
  validateMealPlanGoal
} from './index.util'

// The order 46:214 draws the three goals in. Frozen because it is module-global render input.
const GOAL_ORDER: readonly Goal[] = Object.freeze(['lose', 'maintain', 'gain'] as const)

const WEIGHT_UNIT_LABELS: Readonly<Record<WeightUnitPref, string>> = Object.freeze({
  lb: MEAL_PLAN_LB_UNIT,
  kg: MEAL_PLAN_KG_UNIT
})

// One message per code the validator can return. The two range codes and the goal-side code have no Figma
// copy and no constant of their own, so they borrow the nearest accurate existing one.
const GOAL_ERROR_COPY: Readonly<Record<MealPlanGoalErrorCode, string>> = Object.freeze({
  goal_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  pace_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  goal_weight_invalid: GOAL_WEIGHT_MODAL_ERROR,
  goal_weight_out_of_range: GOAL_WEIGHT_MODAL_ERROR,
  goal_weight_wrong_side: GOAL_WEIGHT_MODAL_ERROR
})

// The answers this step owns. A rejected revision compares only these, so a goal saved here is never
// reported as conflicting with a body measurement or a meal time someone edited on another device.
const GOAL_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'goal',
  'goalWeightKg',
  'paceLbPerWeek'
])

const MealPlanGoalScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanGoalRouteProp>()

  const preferencesQuery = useMealPlanPreferencesQuery()
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, stepsForRoute} = useMealPlanSetupDraft()
  const {returnFromTargets} = useHomeTabsNavigation()
  const weightUnit = useUserData(state => state.weightUnit)

  // The field's own text, null until the user types: the draft holds kilograms, so a keystroke has to survive
  // in the unit it was entered in rather than round-tripping through a conversion on every render.
  const [enteredGoalWeight, setEnteredGoalWeight] = useState<string | null>(null)
  // Validate-on-press (0.7.4): before the first press nothing is wrong yet, afterwards every control shows its
  // own message until it becomes valid again.
  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Live only while a refetched row genuinely differs from this draft: it raises the two answers 0.7.2
  // requires and is cleared the moment either one is taken.
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesQuery.data ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const wizardSteps = stepsForRoute(preferences?.targetRoute ?? 'estimated')
  const isPaceScope = params.mode === 'edit' && params.scope === 'pace'
  const unit = draft.weightUnitPref ?? preferences?.weightUnitPref ?? weightUnitPrefFor(weightUnit)

  // parseGoalWeightInput owns the one-decimal rule in both directions, so the kilograms → display round trip
  // cannot print a float artefact of the conversion.
  const savedGoalWeightText = useMemo(() => {
    if (draft.goalWeightKg === null) {
      return ''
    }

    const inUnit = unit === 'lb' ? kilogramsToPounds(draft.goalWeightKg) : draft.goalWeightKg
    const rounded = parseGoalWeightInput(String(inUnit))

    return rounded === null ? '' : String(rounded)
  }, [draft.goalWeightKg, unit])

  const goalWeightText = enteredGoalWeight ?? savedGoalWeightText

  const validation = validateMealPlanGoal(
    {goal: draft.goal, goalWeightText, paceLbPerWeek: draft.paceLbPerWeek},
    {currentWeightKg: draft.weightKg ?? preferences?.weightKg ?? null, unit}
  )

  const errors = hasSubmitted ? validation.errors : null
  const paceOptions = paceOptionsForGoal(draft.goal)

  const onSelectGoal = useCallback(
    (goal: Goal) => {
      // The pace is dropped with the direction it described: Maintain has no pace, and a pace chosen for a
      // deficit is not the same answer as the same number over maintenance.
      setStepFields('goal', {goal, paceLbPerWeek: isPaceVisible(goal) ? draft.paceLbPerWeek : null})
    },
    [draft.paceLbPerWeek, setStepFields]
  )

  const onSelectPace = useCallback(
    (paceLbPerWeek: PaceLbPerWeek) => {
      setStepFields('goal', {paceLbPerWeek})
    },
    [setStepFields]
  )

  // The step's committed hand-off, in one place so a save that completes and a rejected revision that turns
  // out to already hold this answer take the identical route out.
  const advance = useCallback((): void => {
    setHasConflict(false)

    if (params.mode !== 'edit') {
      navigation.navigate(Screens.MEAL_PLAN_ABOUT_YOU, params)

      return
    }

    // "Goal and body" is one settings row over two screens, so this one pushes the second rather than
    // returning: each step is its own request and commits independently (0.7.4). The pace scope is the second
    // screen of the activity pair, and every other edit opened this step alone.
    if (params.returnTo === 'settings' && params.scope !== 'pace') {
      const bodyParams: StepMode = {mode: 'edit', returnTo: 'settings', origin: params.origin}

      navigation.navigate(Screens.MEAL_PLAN_ABOUT_YOU, bodyParams)

      return
    }

    // The one owner of a return to a named stack route: it pops rather than pushing a duplicate, and keeps
    // the target screen's own params, which this step has no honest source for.
    returnFromTargets({kind: 'stack', route: params.returnTo})
  }, [navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (!validation.isValid || draft.goal === null) {
      return
    }

    const goal = draft.goal
    const goalWeightKg = validation.goalWeightKg
    const paceLbPerWeek = isPaceVisible(goal) ? draft.paceLbPerWeek : null

    // The draft carries the committed value forward to the later steps' summary, and a cleared optional field
    // has to reach it as the null it now is.
    setStepFields('goal', {goalWeightKg, paceLbPerWeek})

    try {
      await saveStepMutation.mutateAsync({
        step: 'goal',
        payload: {
          goal,
          goalWeightKg,
          paceLbPerWeek,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: preferences?.revision
        }
      })
    } catch (error) {
      // Never navigate out of a failure: every entered value stays on screen, the CTA leaves its pending
      // state, and the next press re-sends the step that is still unsaved.
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): the authoritative row is refetched and this
      // step's own answers are compared with it field by field. Equal values mean the write this client lost
      // the response to, or the identical edit from another device, already landed — so it resolves silently
      // rather than reporting a conflict or writing the same answer a second time.
      const refetched = await preferencesQuery.refetch()
      const fresh = refetched.data ?? null

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      if (
        resolveStaleRevision<MealPlanPreferences>({goal, goalWeightKg, paceLbPerWeek}, fresh, GOAL_CONFLICT_FIELDS)
          .status === 'resolved'
      ) {
        advance()

        return
      }

      // A real difference is the user's to settle, so it raises the persistent dialog 0.7.2 requires rather
      // than a toast that fades: 'Keep mine' re-presses this save against the revision just refetched, and a
      // second rejection repeats the cycle.
      setHasConflict(true)

      return
    }

    advance()
  }, [
    advance,
    draft.goal,
    draft.paceLbPerWeek,
    preferences?.revision,
    preferencesQuery,
    saveStepMutation,
    setStepFields,
    validation
  ])

  // 'Use theirs' discards this step's draft answers in favour of the refetched row. The typed field text goes
  // with them: the keystrokes it holds outrank the saved value on every render, so leaving them would keep
  // overriding the answer the user just accepted.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    setEnteredGoalWeight(null)
    seedFromPreferences(preferences)
  }, [preferences, seedFromPreferences])

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <WizardHeader
          step={wizardSteps.indexOf('goal') + 1}
          totalSteps={wizardSteps.length}
          onBack={navigation.goBack}
        />

        {/* The goal-weight field is a number pad away from covering itself, so the scroll region carries the
            keyboard inset while the footer stays pinned outside it (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <Text style={styles.headline}>{MEAL_PLAN_GOAL_TITLE}</Text>

          {!isPaceScope && (
            <View style={styles.optionList} accessibilityRole="radiogroup">
              {GOAL_ORDER.map(goal => (
                <OptionCard
                  key={goal}
                  label={MEAL_PLAN_GOAL_LABELS[goal]}
                  selected={draft.goal === goal}
                  onPress={() => onSelectGoal(goal)}
                />
              ))}
            </View>
          )}

          {errors?.goal != null && <InlineError message={GOAL_ERROR_COPY[errors.goal]} />}

          {!isPaceScope && isGoalWeightVisible(draft.goal) && (
            <View style={styles.labelRow}>
              <Text style={styles.controlLabel}>{MEAL_PLAN_GOAL_WEIGHT_HEADER}</Text>

              <Text style={styles.optionalLabel}>{MEAL_PLAN_OPTIONAL_LABEL}</Text>
            </View>
          )}

          {!isPaceScope && isGoalWeightVisible(draft.goal) && (
            <View style={styles.fieldWrapper}>
              <TextField
                value={goalWeightText}
                onChangeText={setEnteredGoalWeight}
                unit={WEIGHT_UNIT_LABELS[unit]}
                state={errors?.goalWeight == null ? 'default' : 'error'}
                keyboardType="decimal-pad"
                accessibilityLabel={MEAL_PLAN_GOAL_WEIGHT_HEADER}
              />
            </View>
          )}

          {errors?.goalWeight != null && <InlineError message={GOAL_ERROR_COPY[errors.goalWeight]} />}

          {isPaceVisible(draft.goal) && (
            <View style={styles.paceSection}>
              <Text style={styles.controlLabel}>{MEAL_PLAN_PACE_HEADER}</Text>

              <PaceCards options={paceOptions} selected={draft.paceLbPerWeek} onSelect={onSelectPace} />
            </View>
          )}

          {errors?.pace != null && <InlineError message={GOAL_ERROR_COPY[errors.pace]} />}
        </KeyboardAwareScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={saveStepMutation.isPending}
          onPress={onContinuePressed}
        />
      </SetupFooter>

      <RevisionConflictDialog
        isVisible={hasConflict}
        title={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        keepMineLabel={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        useTheirsLabel={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        isKeepMinePending={saveStepMutation.isPending}
        onKeepMine={onContinuePressed}
        onUseTheirs={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanGoalScreen
