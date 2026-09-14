import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {View} from 'react-native'

import type {
  BodyStepPayload,
  HeightUnitPref,
  MealPlanPreferences,
  SexForEstimate,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import type {TargetsReturn} from '@navigation/types'
import {MealPlanAboutYouRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useWeighInsQuery} from '@queries/weighIns/useWeighInsQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import Spacing from '@styles/spacing'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {heightUnitPrefFor, weightUnitPrefFor} from '@utility/UnitConversionUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
import SegmentedControl, {SegmentedControlOption} from '@components/SegmentedControl'
import SetupFooter from '@components/SetupFooter'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ABOUT_YOU_SUBTITLE,
  MEAL_PLAN_ABOUT_YOU_TITLE,
  MEAL_PLAN_AGE_ERROR_TEXT,
  MEAL_PLAN_AGE_HEADER,
  MEAL_PLAN_AGE_UNIT,
  MEAL_PLAN_CM_UNIT,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_CURRENT_WEIGHT_HEADER,
  MEAL_PLAN_FEET_ERROR_TEXT,
  MEAL_PLAN_FEET_UNIT,
  MEAL_PLAN_HEIGHT_ERROR_TEXT,
  MEAL_PLAN_HEIGHT_HEADER,
  MEAL_PLAN_INCHES_ERROR_TEXT,
  MEAL_PLAN_INCHES_UNIT,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_SEX_HEADER,
  MEAL_PLAN_SEX_LABELS,
  MEAL_PLAN_SKIP_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_WEIGHT_ERROR_TEXT,
  MEAL_PLAN_WEIGHT_PREFILL_CAPTION,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'
import {
  ABOUT_YOU_STEP,
  AboutYouErrorCode,
  buildBodyStepValues,
  initialFieldsFor,
  MealPlanAboutYouFields,
  resolveWeighInPrefill,
  selectLatestWeighIn,
  validateAboutYou,
  wizardTotalSteps
} from './index.util'

// The order 46:297 draws the three options in. 'prefer_not_to_say' is an answer, not an absence of one:
// the server resolves it to the manual target route, so it leads where Skip leads.
const SEX_ORDER: readonly SexForEstimate[] = Object.freeze(['female', 'male', 'prefer_not_to_say'] as const)

const HEIGHT_UNIT_OPTIONS: readonly SegmentedControlOption<HeightUnitPref>[] = Object.freeze([
  Object.freeze({key: 'ft_in', label: MEAL_PLAN_FEET_UNIT} as const),
  Object.freeze({key: 'cm', label: MEAL_PLAN_CM_UNIT} as const)
])

const WEIGHT_UNIT_OPTIONS: readonly SegmentedControlOption<WeightUnitPref>[] = Object.freeze([
  Object.freeze({key: 'lb', label: MEAL_PLAN_LB_UNIT} as const),
  Object.freeze({key: 'kg', label: MEAL_PLAN_KG_UNIT} as const)
])

// One message per code the validator can return; the range and required codes of a field share the field's
// single Figma message (03b draws "Enter your age to continue" for both).
const ABOUT_YOU_ERROR_COPY: Readonly<Record<AboutYouErrorCode, string>> = Object.freeze({
  age_required: MEAL_PLAN_AGE_ERROR_TEXT,
  age_range: MEAL_PLAN_AGE_ERROR_TEXT,
  feet_required: MEAL_PLAN_FEET_ERROR_TEXT,
  feet_range: MEAL_PLAN_FEET_ERROR_TEXT,
  inches_range: MEAL_PLAN_INCHES_ERROR_TEXT,
  height_cm_required: MEAL_PLAN_HEIGHT_ERROR_TEXT,
  height_cm_range: MEAL_PLAN_HEIGHT_ERROR_TEXT,
  weight_required: MEAL_PLAN_WEIGHT_ERROR_TEXT,
  weight_range: MEAL_PLAN_WEIGHT_ERROR_TEXT,
  sex_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT
})

// What one attempt at the body step settled. 'saved' covers both a fresh write and a rejected revision the
// refetch proved already holds this answer, because the two are indistinguishable to the caller.
type BodyStepOutcome = 'saved' | 'failed' | 'conflict'

// The measurements this step owns, compared when a revision is rejected so an activity level or a meal time
// edited on another device is never reported as a conflict with a height.
const BODY_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'age',
  'heightCm',
  'weightKg',
  'sexForEstimate',
  'heightUnitPref',
  'weightUnitPref'
])

// Skip supplies no measurement at all: the only thing it asserts is the manual target route, so that is the
// single field a rejected revision is compared on.
const SKIP_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze(['targetRoute'])

const MealPlanAboutYouScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanAboutYouRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  const preferencesQuery = useMealPlanPreferencesQuery()
  const weighInsQuery = useWeighInsQuery()
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, answerBodySkipped} = useMealPlanSetupDraft()
  const weightUnit = useUserData(state => state.weightUnit)

  // Null until the user types: while it is null the fields are still the saved values read in the selected
  // units, so switching a unit re-reads them rather than leaving a number the toggle has contradicted.
  const [enteredFields, setEnteredFields] = useState<MealPlanAboutYouFields | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Live only while a refetched row genuinely differs from what this screen tried to write.
  const [hasConflict, setHasConflict] = useState(false)
  // Which of the step's two answers the live conflict refused. 'Keep mine' re-sends that same answer, and
  // the measurements and Skip are different writes — a ref holds it because it is read when the dialog's
  // button is pressed, never during render.
  const conflictedAnswer = useRef<'body' | 'skip'>('body')

  const preferences = preferencesQuery.data ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const heightUnit = draft.heightUnitPref ?? preferences?.heightUnitPref ?? heightUnitPrefFor(weightUnit)
  const weightUnitPref = draft.weightUnitPref ?? preferences?.weightUnitPref ?? weightUnitPrefFor(weightUnit)

  const prefill = useMemo(
    () => resolveWeighInPrefill(selectLatestWeighIn(weighInsQuery.data ?? []), weightUnit),
    [weighInsQuery.data, weightUnit]
  )

  const savedFields = useMemo(
    () =>
      initialFieldsFor({
        savedAge: draft.age,
        savedHeightCm: draft.heightCm,
        savedWeightKg: draft.weightKg,
        heightUnit,
        weightUnit: weightUnitPref,
        prefill
      }),
    [draft.age, draft.heightCm, draft.weightKg, heightUnit, prefill, weightUnitPref]
  )

  const fields = enteredFields ?? savedFields
  const validation = validateAboutYou(fields, heightUnit, weightUnitPref, draft.sexForEstimate)
  const errors = hasSubmitted ? validation.errors : null

  // The suggestion is labelled only while it is still the suggestion: an edited field, or a weight already
  // saved on the server, is the user's own number and needs no provenance caption (03b drops it).
  const showsPrefillCaption = prefill.showCaption && draft.weightKg === null && enteredFields === null

  const onChangeField = useCallback(
    (field: keyof MealPlanAboutYouFields, text: string) => {
      setEnteredFields(current => ({...(current ?? savedFields), [field]: text}))
    },
    [savedFields]
  )

  const manualTargetsReturn = useMemo<TargetsReturn>(
    // The manual editor sits inside the run it was opened from: in setup it continues forward to Diet, and an
    // edit returns to the row that opened this step.
    () => (params.mode === 'edit' ? {kind: 'stack', route: params.returnTo} : {kind: 'stack', route: 'diet'}),
    [params]
  )

  // Both answers to this step — the measurements and Skip — go out through here, so the rejected-revision
  // recovery 0.7.2 prescribes is written once and cannot differ between them. The comparison is the caller's,
  // because what counts as a conflicting change is exactly what that answer claimed.
  const saveBodyStep = useCallback(
    async (
      payload: BodyStepPayload,
      comparison: Partial<MealPlanPreferences>,
      comparedFields: readonly (keyof MealPlanPreferences & string)[]
    ): Promise<BodyStepOutcome> => {
      try {
        await saveStepMutation.mutateAsync({step: 'body', payload})
        setHasConflict(false)

        return 'saved'
      } catch (error) {
        // The screen stays mounted with every entered measurement intact and the CTA usable again, so the
        // next press re-sends exactly the step that is still unsaved.
        if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
          showToast('error', TOAST_GENERIC_ERROR)

          return 'failed'
        }

        // A rejected revision is never retried blindly: refetch the authoritative row and compare it with
        // what this answer claimed. Equal values mean the write whose response was lost, or the identical
        // edit from another device, already landed — so it resolves silently rather than writing twice.
        const refetched = await preferencesQuery.refetch()
        const fresh = refetched.data ?? null

        if (fresh === null) {
          showToast('error', TOAST_GENERIC_ERROR)

          return 'failed'
        }

        if (resolveStaleRevision<MealPlanPreferences>(comparison, fresh, comparedFields).status === 'resolved') {
          setHasConflict(false)

          return 'saved'
        }

        // A real difference is the user's to settle, so it raises the persistent dialog 0.7.2 requires
        // rather than a toast that fades; a second rejection repeats the cycle.
        setHasConflict(true)

        return 'conflict'
      }
    },
    [preferencesQuery, saveStepMutation]
  )

  const openManualTargets = useCallback(() => {
    navigation.navigate(Screens.MEAL_PLAN_EDIT_TARGETS, {mode: 'manual', returnTo: manualTargetsReturn})
  }, [manualTargetsReturn, navigation])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    const values = buildBodyStepValues(fields, heightUnit, weightUnitPref)

    if (!validation.isValid || values === null || draft.sexForEstimate === null) {
      return
    }

    const sexForEstimate = draft.sexForEstimate

    setStepFields('body', {
      age: values.age,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      sexForEstimate,
      heightUnitPref: heightUnit,
      weightUnitPref
    })

    conflictedAnswer.current = 'body'

    const outcome = await saveBodyStep(
      {
        age: values.age,
        heightCm: values.heightCm,
        weightKg: values.weightKg,
        sexForEstimate,
        heightUnitPref: heightUnit,
        weightUnitPref,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expectedRevision: preferences?.revision
      },
      {
        age: values.age,
        heightCm: values.heightCm,
        weightKg: values.weightKg,
        sexForEstimate,
        heightUnitPref: heightUnit,
        weightUnitPref
      },
      BODY_CONFLICT_FIELDS
    )

    if (outcome !== 'saved') {
      return
    }

    // 'Prefer not to say' leaves the server with no sex to estimate from, so it takes the manual route the
    // same way Skip does — with the measurements it did supply kept.
    if (sexForEstimate === 'prefer_not_to_say') {
      openManualTargets()

      return
    }

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_ACTIVITY, params)
  }, [
    draft.sexForEstimate,
    fields,
    heightUnit,
    navigation,
    openManualTargets,
    params,
    preferences?.revision,
    returnFromTargets,
    saveBodyStep,
    setStepFields,
    validation.isValid,
    weightUnitPref
  ])

  const onSkipPressed = useCallback(async (): Promise<void> => {
    // Skip is the body step's other answer rather than a way past it: it records the manual route and clears
    // no measurement, which is why the draft is told before the request goes out.
    answerBodySkipped()
    conflictedAnswer.current = 'skip'

    const outcome = await saveBodyStep(
      {
        skipped: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expectedRevision: preferences?.revision
      },
      {targetRoute: 'manual'},
      SKIP_CONFLICT_FIELDS
    )

    if (outcome === 'saved') {
      openManualTargets()
    }
  }, [answerBodySkipped, openManualTargets, preferences?.revision, saveBodyStep])

  // 'Keep mine' re-presses the answer the conflict refused, unchanged: the mutation now carries the revision
  // the failed attempt refetched, so the server either accepts it or refuses it again and the cycle repeats.
  const onKeepMinePressed = useCallback(async (): Promise<void> => {
    if (conflictedAnswer.current === 'skip') {
      await onSkipPressed()

      return
    }

    await onContinuePressed()
  }, [onContinuePressed, onSkipPressed])

  // 'Use theirs' discards this step's answers in favour of the refetched row. The typed field text goes with
  // them: while it is set it outranks the saved values on every render, so leaving it would keep overriding
  // the measurements the user just accepted.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    setEnteredFields(null)
    seedFromPreferences(preferences)
  }, [preferences, seedFromPreferences])

  const heightErrorCode = errors?.centimeters ?? errors?.feet ?? errors?.inches ?? null

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <WizardHeader
          step={ABOUT_YOU_STEP}
          totalSteps={wizardTotalSteps(preferences?.targetRoute ?? null)}
          onBack={navigation.goBack}
        />

        {/* Four number pads open over this form, the last of them below the fold, so the scroll region
            carries the keyboard inset while the footer stays pinned outside it (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <Text style={styles.headline}>{MEAL_PLAN_ABOUT_YOU_TITLE}</Text>

          <Text style={styles.subCopy}>{MEAL_PLAN_ABOUT_YOU_SUBTITLE}</Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{MEAL_PLAN_AGE_HEADER}</Text>
              </View>

              <TextField
                value={fields.age}
                onChangeText={text => onChangeField('age', text)}
                placeholder={MEAL_PLAN_AGE_HEADER}
                unit={MEAL_PLAN_AGE_UNIT}
                state={errors?.age == null ? 'default' : 'error'}
                keyboardType="numeric"
                accessibilityLabel={MEAL_PLAN_AGE_HEADER}
              />

              {errors?.age != null && <InlineError message={ABOUT_YOU_ERROR_COPY[errors.age]} />}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{MEAL_PLAN_HEIGHT_HEADER}</Text>

                <SegmentedControl
                  options={[...HEIGHT_UNIT_OPTIONS]}
                  selected={heightUnit}
                  variant="unit"
                  onChange={heightUnitPref => setStepFields('body', {heightUnitPref})}
                />
              </View>

              {heightUnit === 'ft_in' ? (
                <View style={styles.heightRow}>
                  <View style={styles.heightField}>
                    <TextField
                      value={fields.feet}
                      onChangeText={text => onChangeField('feet', text)}
                      placeholder={MEAL_PLAN_FEET_UNIT}
                      unit={MEAL_PLAN_FEET_UNIT}
                      state={errors?.feet == null ? 'default' : 'error'}
                      keyboardType="numeric"
                      accessibilityLabel={MEAL_PLAN_FEET_UNIT}
                    />
                  </View>

                  <View style={styles.heightField}>
                    <TextField
                      value={fields.inches}
                      onChangeText={text => onChangeField('inches', text)}
                      placeholder={MEAL_PLAN_INCHES_UNIT}
                      unit={MEAL_PLAN_INCHES_UNIT}
                      state={errors?.inches == null ? 'default' : 'error'}
                      keyboardType="numeric"
                      accessibilityLabel={MEAL_PLAN_INCHES_UNIT}
                    />
                  </View>
                </View>
              ) : (
                <TextField
                  value={fields.centimeters}
                  onChangeText={text => onChangeField('centimeters', text)}
                  placeholder={MEAL_PLAN_CM_UNIT}
                  unit={MEAL_PLAN_CM_UNIT}
                  state={errors?.centimeters == null ? 'default' : 'error'}
                  keyboardType="decimal-pad"
                  accessibilityLabel={MEAL_PLAN_HEIGHT_HEADER}
                />
              )}

              {heightErrorCode != null && <InlineError message={ABOUT_YOU_ERROR_COPY[heightErrorCode]} />}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{MEAL_PLAN_CURRENT_WEIGHT_HEADER}</Text>

                <SegmentedControl
                  options={[...WEIGHT_UNIT_OPTIONS]}
                  selected={weightUnitPref}
                  variant="unit"
                  onChange={unitPref => setStepFields('body', {weightUnitPref: unitPref})}
                />
              </View>

              <TextField
                value={fields.weight}
                onChangeText={text => onChangeField('weight', text)}
                placeholder={MEAL_PLAN_CURRENT_WEIGHT_HEADER}
                unit={weightUnitPref === 'lb' ? MEAL_PLAN_LB_UNIT : MEAL_PLAN_KG_UNIT}
                state={errors?.weight == null ? 'default' : 'error'}
                keyboardType="decimal-pad"
                accessibilityLabel={MEAL_PLAN_CURRENT_WEIGHT_HEADER}
              />

              {showsPrefillCaption && <Text style={styles.prefillCaption}>{MEAL_PLAN_WEIGHT_PREFILL_CAPTION}</Text>}

              {errors?.weight != null && <InlineError message={ABOUT_YOU_ERROR_COPY[errors.weight]} />}
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>{MEAL_PLAN_SEX_HEADER}</Text>
              </View>

              <View style={styles.sexOptions} accessibilityRole="radiogroup">
                {SEX_ORDER.map(sex => (
                  <OptionCard
                    key={sex}
                    label={MEAL_PLAN_SEX_LABELS[sex]}
                    selected={draft.sexForEstimate === sex}
                    onPress={() => setStepFields('body', {sexForEstimate: sex})}
                  />
                ))}
              </View>

              {errors?.sex != null && <InlineError message={ABOUT_YOU_ERROR_COPY[errors.sex]} />}
            </View>
          </View>
        </KeyboardAwareScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={saveStepMutation.isPending}
          onPress={onContinuePressed}
        />

        <TertiaryTextButton
          label={MEAL_PLAN_SKIP_BUTTON_TEXT}
          disabled={saveStepMutation.isPending}
          onPress={onSkipPressed}
        />
      </SetupFooter>

      <RevisionConflictDialog
        isVisible={hasConflict}
        title={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        keepMineLabel={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        useTheirsLabel={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        isKeepMinePending={saveStepMutation.isPending}
        onKeepMine={onKeepMinePressed}
        onUseTheirs={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanAboutYouScreen
