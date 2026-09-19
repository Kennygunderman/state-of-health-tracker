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
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {TargetsReturn} from '@navigation/types'
import {MealPlanAboutYouRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useWeighInsQuery} from '@queries/weighIns/useWeighInsQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {heightUnitPrefFor, weightUnitPrefFor} from '@utility/UnitConversionUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import SegmentedControl, {SegmentedControlOption} from '@components/SegmentedControl'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
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
  MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_HEIGHT_ERROR_TEXT,
  MEAL_PLAN_HEIGHT_HEADER,
  MEAL_PLAN_HEIGHT_UNIT_ACCESSIBILITY_LABEL,
  MEAL_PLAN_HEIGHT_UNIT_FT_IN,
  MEAL_PLAN_INCHES_ERROR_TEXT,
  MEAL_PLAN_INCHES_UNIT,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
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
  MEAL_PLAN_WEIGHT_UNIT_ACCESSIBILITY_LABEL,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'
import {
  ABOUT_YOU_STEP,
  AboutYouErrorCode,
  AboutYouFieldOverrides,
  buildBodyStepValues,
  convertHeightFieldsToUnit,
  convertWeightFieldToUnit,
  initialFieldsFor,
  MealPlanAboutYouFields,
  mergeAboutYouFields,
  resolveWeighInPrefill,
  selectLatestWeighIn,
  validateAboutYou,
  wizardTotalSteps
} from './index.util'

const SEX_ORDER: readonly SexForEstimate[] = Object.freeze(['female', 'male', 'prefer_not_to_say'] as const)

const HEIGHT_UNIT_OPTIONS: readonly SegmentedControlOption<HeightUnitPref>[] = Object.freeze([
  Object.freeze({key: 'ft_in', label: MEAL_PLAN_HEIGHT_UNIT_FT_IN} as const),
  Object.freeze({key: 'cm', label: MEAL_PLAN_CM_UNIT} as const)
])

const WEIGHT_UNIT_OPTIONS: readonly SegmentedControlOption<WeightUnitPref>[] = Object.freeze([
  Object.freeze({key: 'lb', label: MEAL_PLAN_LB_UNIT} as const),
  Object.freeze({key: 'kg', label: MEAL_PLAN_KG_UNIT} as const)
])

const AGE_MAX_LENGTH = 3
const FEET_MAX_LENGTH = 1
const INCHES_MAX_LENGTH = 2
const CENTIMETERS_MAX_LENGTH = 3
const WEIGHT_MAX_LENGTH = 5

const SKELETON_BLOCK_HEIGHTS: number[] = [
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG
]

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

// 'saved' covers a fresh write and a rejected revision the refetch proved already holds this answer,
// the two being indistinguishable to the caller.
type BodyStepOutcome = 'saved' | 'failed' | 'conflict'

// Only what this step owns: an activity level edited on another device is not a conflict with a height.
const BODY_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'age',
  'heightCm',
  'weightKg',
  'sexForEstimate',
  'heightUnitPref',
  'weightUnitPref'
])

const SKIP_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze(['targetRoute'])

const MealPlanAboutYouScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanAboutYouRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const {
    data: preferencesData,
    isLoading: isLoadingPreferences,
    refetch: refetchPreferences
  } = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const {data: weighInsData} = useWeighInsQuery()
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, answerBodySkipped} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. Each answered branch marks them stored first, so leaving after a save keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('body', params.mode === 'edit')
  const weightUnit = useUserData(state => state.weightUnit)

  const [fieldOverrides, setFieldOverrides] = useState<AboutYouFieldOverrides>({})
  const [isWeightEdited, setIsWeightEdited] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)
  // A ref, not state: it is read when the dialog's button is pressed, never during render.
  const conflictedAnswer = useRef<'body' | 'skip'>('body')

  const preferences = preferencesData ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const heightUnit = draft.heightUnitPref ?? preferences?.heightUnitPref ?? heightUnitPrefFor(weightUnit)
  const weightUnitPref = draft.weightUnitPref ?? preferences?.weightUnitPref ?? weightUnitPrefFor(weightUnit)

  const prefill = useMemo(
    () => resolveWeighInPrefill(selectLatestWeighIn(weighInsData ?? []), weightUnit),
    [weighInsData, weightUnit]
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

  const fields = useMemo(() => mergeAboutYouFields(savedFields, fieldOverrides), [fieldOverrides, savedFields])
  const validation = validateAboutYou(fields, heightUnit, weightUnitPref, draft.sexForEstimate)
  const errors = hasSubmitted ? validation.errors : null

  // A weight the user typed, or one already saved, is their own number and carries no suggestion caption.
  const showsPrefillCaption = prefill.showCaption && draft.weightKg === null && !isWeightEdited

  const onChangeField = useCallback((field: keyof MealPlanAboutYouFields, text: string) => {
    setFieldOverrides(current => ({...current, [field]: text}))

    if (field === 'weight') {
      setIsWeightEdited(true)
    }
  }, [])

  // Only text the user entered is converted. Everything else on screen is derived from the saved row or the
  // weigh-in suggestion, both of which re-derive in the newly selected unit, so converting them into an
  // override would pin the old number and shut out a weigh-in that answers later.
  const onHeightUnitChanged = useCallback(
    (nextUnit: HeightUnitPref) => {
      const hasEnteredHeight =
        fieldOverrides.feet !== undefined ||
        fieldOverrides.inches !== undefined ||
        fieldOverrides.centimeters !== undefined
      const converted = hasEnteredHeight ? convertHeightFieldsToUnit(fields, heightUnit, nextUnit) : {}

      setFieldOverrides(current => ({...current, ...converted}))
      setStepFields('body', {heightUnitPref: nextUnit})
    },
    [fieldOverrides, fields, heightUnit, setStepFields]
  )

  const onWeightUnitChanged = useCallback(
    (nextUnit: WeightUnitPref) => {
      const converted =
        fieldOverrides.weight === undefined
          ? {}
          : convertWeightFieldToUnit(fieldOverrides.weight, weightUnitPref, nextUnit)

      setFieldOverrides(current => ({...current, ...converted}))
      setStepFields('body', {weightUnitPref: nextUnit})
    },
    [fieldOverrides.weight, setStepFields, weightUnitPref]
  )

  const manualTargetsReturn = useMemo<TargetsReturn>(
    () => (params.mode === 'edit' ? {kind: 'stack', route: params.returnTo} : {kind: 'stack', route: 'diet'}),
    [params]
  )

  // What counts as a conflicting change is the caller's, being exactly what its answer claimed.
  const saveBodyStep = useCallback(
    async (
      payload: BodyStepPayload,
      comparison: Partial<MealPlanPreferences>,
      comparedFields: readonly (keyof MealPlanPreferences & string)[]
    ): Promise<BodyStepOutcome> => {
      try {
        await saveSetupStep({step: 'body', payload})
        setHasConflict(false)

        return 'saved'
      } catch (error) {
        if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
          showToast('error', TOAST_GENERIC_ERROR)

          return 'failed'
        }

        // Never retried blindly: equal values mean the write whose response was lost, or the identical edit
        // from another device, already landed, so it resolves silently rather than writing twice.
        const refetched = await refetchPreferences()
        const fresh = authoritativeRefetch(refetched)

        if (fresh === null) {
          showToast('error', TOAST_GENERIC_ERROR)

          return 'failed'
        }

        if (resolveStaleRevision<MealPlanPreferences>(comparison, fresh, comparedFields).status === 'resolved') {
          setHasConflict(false)

          return 'saved'
        }

        setHasConflict(true)

        return 'conflict'
      }
    },
    [refetchPreferences, saveSetupStep]
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

    // The server requires this step's exact revision, so a query that never produced one is asked again.
    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

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
        expectedRevision: saved.revision
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

    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

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
    markSaved,
    navigation,
    openManualTargets,
    params,
    preferences,
    refetchPreferences,
    returnFromTargets,
    saveBodyStep,
    setStepFields,
    validation.isValid,
    weightUnitPref
  ])

  const onSkipPressed = useCallback(async (): Promise<void> => {
    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    answerBodySkipped()
    conflictedAnswer.current = 'skip'

    const outcome = await saveBodyStep(
      {
        skipped: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expectedRevision: saved.revision
      },
      {targetRoute: 'manual'},
      SKIP_CONFLICT_FIELDS
    )

    if (outcome === 'saved') {
      markSaved()
      openManualTargets()
    }
  }, [answerBodySkipped, markSaved, openManualTargets, preferences, refetchPreferences, saveBodyStep])

  const onKeepMinePressed = useCallback(async (): Promise<void> => {
    if (conflictedAnswer.current === 'skip') {
      await onSkipPressed()

      return
    }

    await onContinuePressed()
  }, [onContinuePressed, onSkipPressed])

  // Entered text outranks the saved value on every render, so it goes with the answers 'Use theirs' discards.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    setFieldOverrides({})
    setIsWeightEdited(false)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

  const ageErrorMessage = errors?.age == null ? null : ABOUT_YOU_ERROR_COPY[errors.age]
  const feetErrorMessage = errors?.feet == null ? null : ABOUT_YOU_ERROR_COPY[errors.feet]
  const inchesErrorMessage = errors?.inches == null ? null : ABOUT_YOU_ERROR_COPY[errors.inches]
  const centimetersErrorMessage = errors?.centimeters == null ? null : ABOUT_YOU_ERROR_COPY[errors.centimeters]
  const weightErrorMessage = errors?.weight == null ? null : ABOUT_YOU_ERROR_COPY[errors.weight]

  // A field carries its error in its own label too, so reaching the input later still says what is wrong
  // with it; the row below it announces itself once, when validation runs.
  const ageFieldLabel =
    ageErrorMessage === null
      ? MEAL_PLAN_AGE_HEADER
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_AGE_HEADER,
          message: ageErrorMessage
        })
  const feetFieldLabel =
    feetErrorMessage === null
      ? MEAL_PLAN_FEET_UNIT
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_FEET_UNIT,
          message: feetErrorMessage
        })
  const inchesFieldLabel =
    inchesErrorMessage === null
      ? MEAL_PLAN_INCHES_UNIT
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_INCHES_UNIT,
          message: inchesErrorMessage
        })
  const centimetersFieldLabel =
    centimetersErrorMessage === null
      ? MEAL_PLAN_HEIGHT_HEADER
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_HEIGHT_HEADER,
          message: centimetersErrorMessage
        })
  const weightFieldLabel =
    weightErrorMessage === null
      ? MEAL_PLAN_CURRENT_WEIGHT_HEADER
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_CURRENT_WEIGHT_HEADER,
          message: weightErrorMessage
        })

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        {/* Reopened from a Review or Plan settings row this screen is one step on its own, so it carries the
            back button alone: the segments and the "n of m" counter state setup-flow progress (0.7.4). */}
        <WizardHeader
          step={ABOUT_YOU_STEP}
          totalSteps={wizardTotalSteps(preferences?.targetRoute ?? null)}
          onBack={navigation.goBack}
          isProgressVisible={params.mode !== 'edit'}
        />

        {/* Four number pads open over this form, the last of them below the fold, so the scroll region
            carries the keyboard inset while the footer stays pinned outside it (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <Text style={styles.headline} accessibilityRole="header">
            {MEAL_PLAN_ABOUT_YOU_TITLE}
          </Text>

          <Text style={styles.subCopy}>{MEAL_PLAN_ABOUT_YOU_SUBTITLE}</Text>

          {/* The saved answers decide both the field values and which unit each is read in, so the form waits
              for them rather than rendering defaults it would then contradict. */}
          {isLoadingPreferences && (
            <View style={styles.skeletonGroup} accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
              {SKELETON_BLOCK_HEIGHTS.map((height, index) => (
                <SkeletonBlock
                  key={`${height}-${index}`}
                  height={height}
                  // The stretch style overrides this, but Skeleton sizes its shimmer sweep from the prop, so
                  // the column's own maximum is the width the animation is measured against.
                  width={Sizes.CONTENT_MAX_WIDTH}
                  borderRadius={BorderRadius.CARD_LG}
                  style={styles.skeletonStretch}
                />
              ))}
            </View>
          )}

          {!isLoadingPreferences && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{MEAL_PLAN_AGE_HEADER}</Text>
                </View>

                <View style={styles.controlSlot}>
                  <TextField
                    value={fields.age}
                    onChangeText={text => onChangeField('age', text)}
                    placeholder={MEAL_PLAN_AGE_HEADER}
                    unit={MEAL_PLAN_AGE_UNIT}
                    state={ageErrorMessage === null ? 'default' : 'error'}
                    keyboardType="numeric"
                    maxLength={AGE_MAX_LENGTH}
                    accessibilityLabel={ageFieldLabel}
                  />
                </View>

                {/* Mounted whether or not it carries a message: a live region announces what changes inside
                    it, so one that appears already holding its error is never read out. */}
                <View accessibilityLiveRegion="polite">
                  {ageErrorMessage !== null && <InlineError message={ageErrorMessage} />}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{MEAL_PLAN_HEIGHT_HEADER}</Text>

                  <View
                    style={styles.unitToggleGroup}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={MEAL_PLAN_HEIGHT_UNIT_ACCESSIBILITY_LABEL}>
                    <SegmentedControl
                      options={[...HEIGHT_UNIT_OPTIONS]}
                      selected={heightUnit}
                      variant="unit"
                      onChange={onHeightUnitChanged}
                    />
                  </View>
                </View>

                {heightUnit === 'ft_in' ? (
                  <View style={styles.heightRow}>
                    <View style={styles.heightField}>
                      <TextField
                        value={fields.feet}
                        onChangeText={text => onChangeField('feet', text)}
                        placeholder={MEAL_PLAN_FEET_UNIT}
                        unit={MEAL_PLAN_FEET_UNIT}
                        state={feetErrorMessage === null ? 'default' : 'error'}
                        keyboardType="numeric"
                        maxLength={FEET_MAX_LENGTH}
                        accessibilityLabel={feetFieldLabel}
                      />
                    </View>

                    <View style={styles.heightField}>
                      <TextField
                        value={fields.inches}
                        onChangeText={text => onChangeField('inches', text)}
                        placeholder={MEAL_PLAN_INCHES_UNIT}
                        unit={MEAL_PLAN_INCHES_UNIT}
                        state={inchesErrorMessage === null ? 'default' : 'error'}
                        keyboardType="numeric"
                        maxLength={INCHES_MAX_LENGTH}
                        accessibilityLabel={inchesFieldLabel}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.controlSlot}>
                    <TextField
                      value={fields.centimeters}
                      onChangeText={text => onChangeField('centimeters', text)}
                      placeholder={MEAL_PLAN_CM_UNIT}
                      unit={MEAL_PLAN_CM_UNIT}
                      state={centimetersErrorMessage === null ? 'default' : 'error'}
                      keyboardType="decimal-pad"
                      maxLength={CENTIMETERS_MAX_LENGTH}
                      accessibilityLabel={centimetersFieldLabel}
                    />
                  </View>
                )}

                {/* Each half of the paired row reports itself: 03b draws the error under the row rather than
                    under the field, so an invalid foot count and an invalid inch count are two rows there and
                    neither hides the other. */}
                <View accessibilityLiveRegion="polite">
                  {feetErrorMessage !== null && <InlineError message={feetErrorMessage} />}
                </View>

                <View accessibilityLiveRegion="polite">
                  {inchesErrorMessage !== null && <InlineError message={inchesErrorMessage} />}
                </View>

                <View accessibilityLiveRegion="polite">
                  {centimetersErrorMessage !== null && <InlineError message={centimetersErrorMessage} />}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{MEAL_PLAN_CURRENT_WEIGHT_HEADER}</Text>

                  <View
                    style={styles.unitToggleGroup}
                    accessibilityRole="radiogroup"
                    accessibilityLabel={MEAL_PLAN_WEIGHT_UNIT_ACCESSIBILITY_LABEL}>
                    <SegmentedControl
                      options={[...WEIGHT_UNIT_OPTIONS]}
                      selected={weightUnitPref}
                      variant="unit"
                      onChange={onWeightUnitChanged}
                    />
                  </View>
                </View>

                <View style={styles.controlSlot}>
                  <TextField
                    value={fields.weight}
                    onChangeText={text => onChangeField('weight', text)}
                    placeholder={MEAL_PLAN_CURRENT_WEIGHT_HEADER}
                    unit={weightUnitPref === 'lb' ? MEAL_PLAN_LB_UNIT : MEAL_PLAN_KG_UNIT}
                    state={weightErrorMessage === null ? 'default' : 'error'}
                    keyboardType="decimal-pad"
                    maxLength={WEIGHT_MAX_LENGTH}
                    accessibilityLabel={weightFieldLabel}
                  />
                </View>

                {showsPrefillCaption && <Text style={styles.prefillCaption}>{MEAL_PLAN_WEIGHT_PREFILL_CAPTION}</Text>}

                <View accessibilityLiveRegion="polite">
                  {weightErrorMessage !== null && <InlineError message={weightErrorMessage} />}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{MEAL_PLAN_SEX_HEADER}</Text>
                </View>

                <View
                  style={styles.sexOptions}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={MEAL_PLAN_SEX_HEADER}>
                  {SEX_ORDER.map(sex => (
                    <OptionCard
                      key={sex}
                      label={MEAL_PLAN_SEX_LABELS[sex]}
                      selected={draft.sexForEstimate === sex}
                      onPress={() => setStepFields('body', {sexForEstimate: sex})}
                    />
                  ))}
                </View>

                <View accessibilityLiveRegion="polite">
                  {errors?.sex != null && <InlineError message={ABOUT_YOU_ERROR_COPY[errors.sex]} />}
                </View>
              </View>
            </View>
          )}
        </KeyboardAwareScrollView>
      </ContentColumn>

      <SetupFooter>
        {/* Both actions stay live while the preferences read is in flight: 0.7.4 gives setup one validation
            rule — the CTA is enabled and validates on press — and reserves disabling for a pending write.
            Neither handler needs the read to have settled, because each asks for the revision it must name
            (`preferencesQuery.refetch()`) and reports rather than writing blind when none comes back. */}
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={isSaving}
          onPress={onContinuePressed}
          style={styles.ctaHeight}
        />

        {/* Skip is how setup declines the estimate, so setup is where it is offered. An edit opened from a
            Review or Plan settings row is changing one answer, not choosing a target route. */}
        {params.mode !== 'edit' && (
          <TertiaryTextButton label={MEAL_PLAN_SKIP_BUTTON_TEXT} disabled={isSaving} onPress={onSkipPressed} />
        )}
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
        onConfirmPressed={onKeepMinePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanAboutYouScreen
