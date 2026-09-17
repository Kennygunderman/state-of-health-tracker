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
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {kilogramsToPounds, weightUnitPrefFor} from '@utility/UnitConversionUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import SetupFooter from '@components/SetupFooter'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_GOAL_TITLE,
  MEAL_PLAN_GOAL_WEIGHT_DIRECTION_ERROR_TEXT,
  MEAL_PLAN_GOAL_WEIGHT_HEADER,
  MEAL_PLAN_GOAL_WEIGHT_INVALID_ERROR_TEXT,
  MEAL_PLAN_GOAL_WEIGHT_RANGE_ERROR_TEXT,
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

const GOAL_ORDER: readonly Goal[] = Object.freeze(['lose', 'maintain', 'gain'] as const)

const WEIGHT_UNIT_LABELS: Readonly<Record<WeightUnitPref, string>> = Object.freeze({
  lb: MEAL_PLAN_LB_UNIT,
  kg: MEAL_PLAN_KG_UNIT
})

// Matches the shipped weight input, and is exactly the widest value the 30-300 kg envelope admits at one
// decimal: 661.3 lb, since 661.4 converts to 300.006 kg and is rejected.
const MAX_GOAL_WEIGHT_INPUT_LENGTH = 5

// The three goal-weight codes deliberately differ: an out-of-range weight and one on the wrong side of the
// current weight are cleared by different edits.
const GOAL_ERROR_COPY: Readonly<Record<MealPlanGoalErrorCode, string>> = Object.freeze({
  goal_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  pace_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  goal_weight_invalid: MEAL_PLAN_GOAL_WEIGHT_INVALID_ERROR_TEXT,
  goal_weight_out_of_range: MEAL_PLAN_GOAL_WEIGHT_RANGE_ERROR_TEXT,
  goal_weight_wrong_side: MEAL_PLAN_GOAL_WEIGHT_DIRECTION_ERROR_TEXT
})

// The answers this step owns: a body measurement or meal time edited elsewhere is not a conflict here.
const GOAL_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'goal',
  'goalWeightKg',
  'paceLbPerWeek'
])

const MealPlanGoalScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanGoalRouteProp>()

  const {data: preferencesData, refetch: refetchPreferences} = useMealPlanPreferencesQuery()
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, stepsForRoute} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. A successful save marks them stored first, so leaving after one keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('goal', params.mode === 'edit')
  const {returnFromTargets} = useHomeTabsNavigation()
  const weightUnit = useUserData(state => state.weightUnit)

  // The draft holds kilograms, so a keystroke survives in the unit it was entered in rather than
  // round-tripping through a conversion on every render.
  const [enteredGoalWeight, setEnteredGoalWeight] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesData ?? null

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
      // A pace under maintenance is not the same answer as the same number over it.
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

  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

    if (params.mode !== 'edit') {
      navigation.navigate(Screens.MEAL_PLAN_ABOUT_YOU, params)

      return
    }

    // "Goal and body" is one settings row over two screens, so this one pushes the second rather than
    // returning; each step is its own request and commits independently (0.7.4).
    if (params.returnTo === 'settings' && params.scope !== 'pace') {
      const bodyParams: StepMode = {mode: 'edit', returnTo: 'settings', origin: params.origin}

      navigation.navigate(Screens.MEAL_PLAN_ABOUT_YOU, bodyParams)

      return
    }

    returnFromTargets({kind: 'stack', route: params.returnTo})
  }, [markSaved, navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (!validation.isValid || draft.goal === null) {
      return
    }

    const goal = draft.goal
    const goalWeightKg = validation.goalWeightKg
    const paceLbPerWeek = isPaceVisible(goal) ? draft.paceLbPerWeek : null

    // A cleared optional field has to reach the later steps' summary as the null it now is.
    setStepFields('goal', {goalWeightKg, paceLbPerWeek})

    // The server requires this step's exact revision, so a query that never produced one is asked again.
    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveSetupStep({
        step: 'goal',
        payload: {
          goal,
          goalWeightKg,
          paceLbPerWeek,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: saved.revision
        }
      })
    } catch (error) {
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): equal values mean this client's own lost write, or
      // the identical edit from another device, already landed, so it resolves silently rather than writing again.
      const refetched = await refetchPreferences()
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

      setHasConflict(true)

      return
    }

    advance()
  }, [
    advance,
    draft.goal,
    draft.paceLbPerWeek,
    preferences,
    refetchPreferences,
    saveSetupStep,
    setStepFields,
    validation
  ])

  // The typed field text is cleared with the draft: it outranks the saved value on every render, so leaving
  // it would keep overriding the answer 'Use theirs' just accepted.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    setEnteredGoalWeight(null)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

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
              {/* The frame draws this field filled with sample data; an optional field opens empty, so the
                  header doubles as the placeholder exactly as the body step's fields do. */}
              <TextField
                value={goalWeightText}
                onChangeText={setEnteredGoalWeight}
                placeholder={MEAL_PLAN_GOAL_WEIGHT_HEADER}
                unit={WEIGHT_UNIT_LABELS[unit]}
                state={errors?.goalWeight == null ? 'default' : 'error'}
                keyboardType="decimal-pad"
                maxLength={MAX_GOAL_WEIGHT_INPUT_LENGTH}
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
          isLoading={isSaving}
          onPress={onContinuePressed}
        />
      </SetupFooter>

      <ConfirmModal
        isVisible={hasConflict}
        confirmationTitle={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        confirmButtonText={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        confirmButtonColor={Theme.colors.accentGreen}
        cancelButtonText={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        cancelButtonColor={Theme.colors.track}
        isConfirmPending={isSaving}
        avoidKeyboard
        onConfirmPressed={onContinuePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanGoalScreen
