import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {View} from 'react-native'

import type {Goal, MealPlanPreferences, PaceLbPerWeek, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {StepMode} from '@navigation/types'
import {MealPlanGoalRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {composeAccessibleName} from '@utility/AccessibilityUtility'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
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
  MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_GOAL_LABELS,
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
  TOAST_GENERIC_ERROR,
  stringWithNamedParameters
} from '@constants/strings'

import PaceCards from './components/PaceCards'
import styles from './index.styled'
import {
  isGoalWeightVisible,
  isPaceVisible,
  MealPlanGoalErrorCode,
  paceOptionsForGoal,
  parseGoalWeightInput,
  resolveMealPlanGoalHeadings,
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

// The label row above the field draws the header and its optional qualifier, and is hidden from assistive
// technology because the field already announces the header — two stops saying "Goal weight" are
// indistinguishable by rotor. The qualifier is the only thing that row said and the field did not, so it rides
// on the field's own name instead of being lost with the row.
const GOAL_WEIGHT_ACCESSIBILITY_LABEL =
  composeAccessibleName([MEAL_PLAN_GOAL_WEIGHT_HEADER, MEAL_PLAN_OPTIONAL_LABEL]) ?? MEAL_PLAN_GOAL_WEIGHT_HEADER

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

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const {data: preferencesData, refetch: refetchPreferences} = useMealPlanPreferencesQuery(isGatedRequestAllowed)
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
  const headings = resolveMealPlanGoalHeadings(isPaceScope)
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
      const fresh = authoritativeRefetch(refetched)

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

  // The field carries its error in its own name too, so reaching the input later still says what is wrong
  // with it; the row below it announces itself once, when validation runs. Both forms are built on
  // `GOAL_WEIGHT_ACCESSIBILITY_LABEL` rather than the bare header, so the "Optional" qualifier the hidden
  // label row would otherwise have taken with it rides on the name in the error case as well as the clean one.
  const goalWeightFieldLabel =
    errors?.goalWeight == null
      ? GOAL_WEIGHT_ACCESSIBILITY_LABEL
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: GOAL_WEIGHT_ACCESSIBILITY_LABEL,
          message: GOAL_ERROR_COPY[errors.goalWeight]
        })

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        {/* Progress belongs to the setup flow. Reopened from a Review or Plan settings row this screen is one
            step on its own, returning to where it was opened from rather than continuing to the next step, so
            the segments and the "n of m" counter would assert a flow the user is not in (0.7.4 edit mode). */}
        <WizardHeader
          step={wizardSteps.indexOf('goal') + 1}
          totalSteps={wizardSteps.length}
          onBack={navigation.goBack}
          isProgressVisible={params.mode !== 'edit'}
        />

        {/* The goal-weight field is a number pad away from covering itself, so the scroll region carries the
            keyboard inset while the footer stays pinned outside it (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          {/* The pace-scope edit hides every goal control, so the headline asks the question this route is
              actually for rather than one whose answers are all suppressed (0.7.4). */}
          <Text style={styles.headline} accessibilityRole="header">
            {headings.headline}
          </Text>

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

          {/* Mounted whether or not it carries a message: a live region announces what changes inside it,
              so one that appears already holding its error is never read out. */}
          <View accessibilityLiveRegion="polite">
            {errors?.goal != null && <InlineError message={GOAL_ERROR_COPY[errors.goal]} />}
          </View>

          {!isPaceScope && isGoalWeightVisible(draft.goal) && (
            <View style={styles.labelRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.controlLabel}>{MEAL_PLAN_GOAL_WEIGHT_HEADER}</Text>

              <Text style={styles.optionalLabel}>{MEAL_PLAN_OPTIONAL_LABEL}</Text>
            </View>
          )}

          {!isPaceScope && isGoalWeightVisible(draft.goal) && (
            <View style={styles.fieldWrapper}>
              {/* Frame 02 draws this field filled — its goal-weight input `46:197` carries the value "170" and a
                  "lb" suffix — but AAP 0.1.2 forbids treating the mockup's selected values as answers a user
                  already chose, and AAP 0.7.4's first-entry state for 02 opens the goal weight empty, so the
                  header doubles as the placeholder exactly as the body step's fields do. */}
              <TextField
                value={goalWeightText}
                onChangeText={setEnteredGoalWeight}
                placeholder={MEAL_PLAN_GOAL_WEIGHT_HEADER}
                unit={WEIGHT_UNIT_LABELS[unit]}
                state={errors?.goalWeight == null ? 'default' : 'error'}
                keyboardType="decimal-pad"
                maxLength={MAX_GOAL_WEIGHT_INPUT_LENGTH}
                accessibilityLabel={goalWeightFieldLabel}
              />
            </View>
          )}

          <View accessibilityLiveRegion="polite">
            {errors?.goalWeight != null && <InlineError message={GOAL_ERROR_COPY[errors.goalWeight]} />}
          </View>

          {isPaceVisible(draft.goal) && (
            <View style={styles.paceSection}>
              {/* Dropped where the headline above has become the pace question itself: the label would
                  otherwise repeat those words two lines under it. */}
              {headings.isPaceLabelVisible && <Text style={styles.controlLabel}>{MEAL_PLAN_PACE_HEADER}</Text>}

              <PaceCards options={paceOptions} selected={draft.paceLbPerWeek} onSelect={onSelectPace} />
            </View>
          )}

          <View accessibilityLiveRegion="polite">
            {errors?.pace != null && <InlineError message={GOAL_ERROR_COPY[errors.pace]} />}
          </View>
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
