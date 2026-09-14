import React, {useCallback, useMemo, useRef, useState} from 'react'

import {View} from 'react-native'

import type {MacroTargets} from '@data/models/Macros'
import type {NutritionTargets} from '@data/models/NutritionTargets'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanEditTargetsRouteProp} from '@navigation/types'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {useSaveNutritionTargetsMutation} from '@queries/mealPlanning/useSaveNutritionTargetsMutation'
import {useTargetEstimateQuery} from '@queries/mealPlanning/useTargetEstimateQuery'
import {useRoute} from '@react-navigation/native'
import Spacing from '@styles/spacing'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import InfoBanner from '@components/InfoBanner'
import InlineError from '@components/InlineError'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
import SetupFooter from '@components/SetupFooter'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'

import {
  CANCEL_BUTTON_TEXT,
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CALORIES_HEADER,
  MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT,
  MEAL_PLAN_CARBS_TARGET_ERROR_TEXT,
  MEAL_PLAN_EDIT_TARGETS_SUBTITLE,
  MEAL_PLAN_EDIT_TARGETS_TITLE,
  MEAL_PLAN_FAT_TARGET_ERROR_TEXT,
  MEAL_PLAN_GENERATION_TERMINAL_COPY,
  MEAL_PLAN_GRAMS_UNIT,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MANUAL_MACROS_BANNER_BODY,
  MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT,
  MEAL_PLAN_REVIEW_HEADER_LABEL,
  MEAL_PLAN_SAVE_TARGETS_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'
import {
  EditTargetsFieldKey,
  EditTargetsFields,
  feasibilityBannerBody,
  resolveEditTargetsIntent,
  resolveTargetsSave,
  sanitizeIntegerInput,
  validateEditTargets
} from './index.util'

interface TargetFieldSpec {
  readonly key: EditTargetsFieldKey
  readonly label: string
  readonly unit: string
  readonly errorMessage: string
}

// The four fields in the order 34:214 draws them, each with the message 09b shows for it.
const TARGET_FIELDS: readonly TargetFieldSpec[] = Object.freeze([
  Object.freeze({
    key: 'calories',
    label: MEAL_PLAN_CALORIES_HEADER,
    unit: MEAL_PLAN_KCAL_UNIT,
    errorMessage: MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT
  } as const),
  Object.freeze({
    key: 'protein',
    label: MEAL_PLAN_MACRO_LABELS.protein,
    unit: MEAL_PLAN_GRAMS_UNIT,
    errorMessage: MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT
  } as const),
  Object.freeze({
    key: 'carbs',
    label: MEAL_PLAN_MACRO_LABELS.carbs,
    unit: MEAL_PLAN_GRAMS_UNIT,
    errorMessage: MEAL_PLAN_CARBS_TARGET_ERROR_TEXT
  } as const),
  Object.freeze({
    key: 'fat',
    label: MEAL_PLAN_MACRO_LABELS.fat,
    unit: MEAL_PLAN_GRAMS_UNIT,
    errorMessage: MEAL_PLAN_FAT_TARGET_ERROR_TEXT
  } as const)
])

const BLANK_FIELDS: EditTargetsFields = Object.freeze({calories: '', protein: '', carbs: '', fat: ''})

// Whole digits only, and rounded exactly as index.util's estimate comparison rounds: a field showing 1940 has
// to count as holding an estimate of 1940.4, or an explicit confirmation would be demoted to a manual save.
const fieldText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(Math.round(value))

// A rejected targets revision is compared on the figures alone: everything else TargetsResponse carries is
// server-derived from them, so comparing it would report the server's bookkeeping as the user's change.
const TARGETS_CONFLICT_FIELDS: readonly (keyof NutritionTargets & string)[] = Object.freeze(['targets'])

const MealPlanEditTargetsScreen = (): React.JSX.Element => {
  const {params} = useRoute<MealPlanEditTargetsRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  const targetsQuery = useNutritionTargetsQuery()
  const estimateQuery = useTargetEstimateQuery()
  const saveTargetsMutation = useSaveNutritionTargetsMutation()

  const [enteredFields, setEnteredFields] = useState<EditTargetsFields | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  // The advisory the server returned with its 200. It is not an error and never blocked the write; it is held
  // so the figures that provoked it are still on screen while the user reads it.
  const [feasibilityBody, setFeasibilityBody] = useState<string | null>(null)
  // The draft a refused press asserted, held only while a refetched row genuinely differs from it. Holding
  // the figures rather than a flag is what lets "Keep mine" re-send them and not whatever the refetch shows.
  const [conflictFields, setConflictFields] = useState<EditTargetsFields | null>(null)

  // What the last successful save wrote. A second press on the same figures returns instead of writing them
  // again, so a failure later in the sequence cannot turn one confirmation into two revisions.
  const savedFields = useRef<EditTargetsFields | null>(null)

  const targets = targetsQuery.data ?? null
  const estimate = estimateQuery.data ?? null

  const intent = resolveEditTargetsIntent({mode: params.mode, routeIntent: params.intent, targets})

  // What the editor opens on: blank on the manual route (Skip or "Prefer not to say"), the calculated estimate
  // when there is nothing saved to edit, and the saved figures otherwise.
  const openingFields = useMemo<EditTargetsFields>(() => {
    const source: MacroTargets | null =
      intent === 'manual_entry' ? null : intent === 'confirm_estimate' ? estimate : (targets?.targets ?? null)

    if (source === null) {
      return BLANK_FIELDS
    }

    return {
      calories: fieldText(source.calories),
      protein: fieldText(source.protein),
      carbs: fieldText(source.carbs),
      fat: fieldText(source.fat)
    }
  }, [estimate, intent, targets])

  const fields = enteredFields ?? openingFields
  const validation = validateEditTargets(fields)
  const errors = hasSubmitted ? validation.errors : {}

  const onChangeField = useCallback(
    (key: EditTargetsFieldKey, text: string) => {
      setEnteredFields(current => ({...(current ?? openingFields), [key]: sanitizeIntegerInput(text)}))
      // Edited figures are no longer the ones the advisory described.
      setFeasibilityBody(null)
    },
    [openingFields]
  )

  const onCancelPressed = useCallback(() => {
    returnFromTargets(params.returnTo)
  }, [params.returnTo, returnFromTargets])

  const submitTargets = useCallback(
    async (submittedFields: EditTargetsFields): Promise<void> => {
      setHasSubmitted(true)

      if (!validateEditTargets(submittedFields).isValid) {
        return
      }

      const alreadySaved = savedFields.current

      if (
        alreadySaved !== null &&
        alreadySaved.calories === submittedFields.calories &&
        alreadySaved.protein === submittedFields.protein &&
        alreadySaved.carbs === submittedFields.carbs &&
        alreadySaved.fat === submittedFields.fat
      ) {
        returnFromTargets(params.returnTo)

        return
      }

      const decision = resolveTargetsSave({intent, fields: submittedFields, estimate, targets})

      if (decision.kind === 'invalid') {
        return
      }

      // The saved figures are already exactly these, and re-saving them as the user's own would clear a
      // staleness they have not acted on — so the editor returns without a write.
      if (decision.kind === 'unchanged') {
        returnFromTargets(params.returnTo)

        return
      }

      try {
        const result = await saveTargetsMutation.mutateAsync(decision.payload)

        savedFields.current = submittedFields
        setConflictFields(null)

        const advisory = feasibilityBannerBody(result.feasibility.warnings)

        if (advisory !== null) {
          // The write committed; staying is what gives the advisory somewhere to be read. The next press is
          // the repeat the ref above recognises, so it returns without writing again.
          setFeasibilityBody(advisory)

          return
        }

        returnFromTargets(params.returnTo)
      } catch (error) {
        const code = getApiErrorCode(error)

        // An estimate computed from inputs that have since moved is refused rather than stored: the figures are
        // refetched and the user stays here to review them. Never an automatic retry, never a navigation.
        if (code === API_ERROR_CODES.estimateStale) {
          estimateQuery.refetch()
          showToast('error', MEAL_PLAN_GENERATION_TERMINAL_COPY.stale_revision.body)

          return
        }

        if (code !== API_ERROR_CODES.staleTargets) {
          showToast('error', TOAST_GENERIC_ERROR)

          return
        }

        // A rejected revision is never retried blindly (0.7.2): the authoritative targets are refetched and
        // the figures this press asserted are compared with them. Equal figures mean the write whose response
        // was lost, or the same edit from another device, already landed — so it resolves silently.
        const refetched = await targetsQuery.refetch()
        const fresh = refetched.data ?? null

        // The figures the attempt asserted: its own for a manual save, the estimate's for a confirmation —
        // which is the only shape 'estimated' can carry, since that payload sends a revision, not numbers.
        const asserted: MacroTargets | null =
          decision.payload.source === 'manual'
            ? {
                calories: decision.payload.calories,
                protein: decision.payload.protein,
                carbs: decision.payload.carbs,
                fat: decision.payload.fat
              }
            : estimate === null
              ? null
              : {
                  calories: estimate.calories,
                  protein: estimate.protein,
                  carbs: estimate.carbs,
                  fat: estimate.fat
                }

        if (fresh === null || asserted === null) {
          showToast('error', TOAST_GENERIC_ERROR)

          return
        }

        if (
          resolveStaleRevision<NutritionTargets>({targets: asserted}, fresh, TARGETS_CONFLICT_FIELDS).status ===
          'resolved'
        ) {
          savedFields.current = submittedFields
          setConflictFields(null)
          returnFromTargets(params.returnTo)

          return
        }

        // A real difference is the user's to settle, so the prompt stays up until they answer it: "Keep mine"
        // re-submits these figures against the revision just refetched, "Use theirs" abandons them.
        setConflictFields(submittedFields)
      }
    },
    [estimate, estimateQuery, intent, params.returnTo, returnFromTargets, saveTargetsMutation, targets, targetsQuery]
  )

  const onSavePressed = useCallback((): void => {
    submitTargets(fields)
  }, [fields, submitTargets])

  const onKeepMinePressed = useCallback((): void => {
    if (conflictFields === null) {
      return
    }

    // Shown as well as re-sent: the refetch has moved the opening figures under a user who never typed, and
    // the fields have to hold what the press is asserting.
    setEnteredFields(conflictFields)
    submitTargets(conflictFields)
  }, [conflictFields, submitTargets])

  // 'Use theirs' abandons the entered figures for the ones the server holds: the editor reopens on them by
  // leaving, because its opening values are derived from the targets query it has just refetched.
  const onUseTheirsPressed = useCallback((): void => {
    setConflictFields(null)
    returnFromTargets(params.returnTo)
  }, [params.returnTo, returnFromTargets])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        {/* The four number-pad fields sit above the banner and the pinned footer, so the scroll region carries
            the keyboard inset while the footer stays outside it (AAP 0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <View style={styles.header}>
            <BackCircleButton onPress={onCancelPressed} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

            <Text style={styles.headerLabel}>{MEAL_PLAN_REVIEW_HEADER_LABEL}</Text>
          </View>

          <Text style={styles.headline}>{MEAL_PLAN_EDIT_TARGETS_TITLE}</Text>

          <Text style={styles.subCopy}>{MEAL_PLAN_EDIT_TARGETS_SUBTITLE}</Text>

          <View style={styles.fieldGroup}>
            {TARGET_FIELDS.map(field => (
              <View key={field.key} style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{field.label}</Text>

                <TextField
                  value={fields[field.key]}
                  onChangeText={text => onChangeField(field.key, text)}
                  placeholder={field.label}
                  unit={field.unit}
                  state={errors[field.key] === undefined ? 'default' : 'error'}
                  keyboardType="numeric"
                  accessibilityLabel={field.label}
                />

                {errors[field.key] !== undefined && <InlineError message={field.errorMessage} />}
              </View>
            ))}
          </View>

          <View style={styles.bannerWrapper}>
            {feasibilityBody === null ? (
              <InfoBanner tone="success" glyph="info" body={MEAL_PLAN_MANUAL_MACROS_BANNER_BODY} />
            ) : (
              <InfoBanner tone="neutral" glyph="info" body={feasibilityBody} />
            )}
          </View>
        </KeyboardAwareScrollView>
      </ContentColumn>

      <SetupFooter hairline>
        <PrimaryButton
          label={MEAL_PLAN_SAVE_TARGETS_BUTTON_TEXT}
          isLoading={saveTargetsMutation.isPending}
          onPress={onSavePressed}
        />

        <TertiaryTextButton
          label={CANCEL_BUTTON_TEXT}
          disabled={saveTargetsMutation.isPending}
          onPress={onCancelPressed}
        />
      </SetupFooter>

      <RevisionConflictDialog
        isVisible={conflictFields !== null}
        title={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        keepMineLabel={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        useTheirsLabel={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        isKeepMinePending={saveTargetsMutation.isPending}
        onKeepMine={onKeepMinePressed}
        onUseTheirs={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanEditTargetsScreen
