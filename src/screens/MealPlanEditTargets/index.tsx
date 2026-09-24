import React, {useCallback, useMemo, useRef, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import type {MacroTargets} from '@data/models/Macros'
import type {NutritionTargets, NutritionTargetsEditIntent} from '@data/models/NutritionTargets'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanEditTargetsRouteProp} from '@navigation/types'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {
  isNutritionTargetsReadFailure,
  isNutritionTargetsRouteMissing,
  selectNutritionTargets
} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useSaveNutritionTargetsMutation} from '@queries/mealPlanning/useSaveNutritionTargetsMutation'
import {useTargetEstimateQuery} from '@queries/mealPlanning/useTargetEstimateQuery'
import {useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import ColumnScrollView from '@components/ColumnScrollView'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InfoBanner from '@components/InfoBanner'
import InlineError from '@components/InlineError'
import PrimaryButton from '@components/PrimaryButton'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'

import {
  CANCEL_BUTTON_TEXT,
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CALORIES_HEADER,
  MEAL_PLAN_CHOSEN_TARGETS_CAPTION,
  MEAL_PLAN_CHOSEN_TARGETS_TITLE,
  MEAL_PLAN_DONE_BUTTON_TEXT,
  MEAL_PLAN_EDIT_TARGETS_SUBTITLE,
  MEAL_PLAN_EDIT_TARGETS_TITLE,
  MEAL_PLAN_ENTER_TARGETS_MANUALLY_BUTTON_TEXT,
  MEAL_PLAN_ESTIMATE_UNAVAILABLE_TITLE,
  MEAL_PLAN_FRESH_ESTIMATE_TEMPLATE,
  MEAL_PLAN_GENERATION_TERMINAL_COPY,
  MEAL_PLAN_GRAMS_UNIT,
  MEAL_PLAN_GRAMS_UNIT_ACCESSIBILITY_TEXT,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_KCAL_UNIT_ACCESSIBILITY_TEXT,
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MANUAL_MACROS_BANNER_BODY,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_REVIEW_HEADER_LABEL,
  MEAL_PLAN_SAVE_TARGETS_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_TARGETS_ACTION_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNAVAILABLE_TEXT,
  stringWithNamedParameters,
  targetFieldErrorText,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles, {RECALCULATE_HIT_SLOP} from './index.styled'
import {
  CALORIES_MAX,
  CALORIES_MIN,
  EditTargetsFieldKey,
  EditTargetsFields,
  feasibilityBannerBody,
  MACRO_MAX,
  MACRO_MIN,
  resolveEditTargetsIntent,
  resolveEditTargetsReadiness,
  resolveTargetsSave,
  sanitizeIntegerInput,
  shouldOfferRecalculate,
  targetFieldAccessibilityLabel,
  targetFieldDisplayText,
  targetFieldMaxLength,
  targetFieldText,
  validateEditTargets
} from './index.util'

interface TargetFieldSpec {
  readonly key: EditTargetsFieldKey
  readonly label: string
  readonly unit: string
  readonly unitAccessibilityText: string
  // The field's own bounds as the message states them, already grouped by the formatter the field displays its
  // value with, so '6,000' in the error reads the way '6,000' reads in the input. What the message is stays in
  // @constants/strings, keyed by field and by the validator's code; the numbers stay in index.util, which is
  // what enforces them. Holding the text here is what keeps a bound and the sentence naming it from drifting.
  readonly minText: string
  readonly maxText: string
}

// The four fields in the order 34:214 draws them. The character limit is deliberately not held here: it depends
// on what the field is currently showing as well as on the field's own bound — a stored target wider than the
// bound must still display in full — so it is computed per render from the displayed text instead.
const TARGET_FIELDS: readonly TargetFieldSpec[] = Object.freeze([
  Object.freeze({
    key: 'calories',
    label: MEAL_PLAN_CALORIES_HEADER,
    unit: MEAL_PLAN_KCAL_UNIT,
    unitAccessibilityText: MEAL_PLAN_KCAL_UNIT_ACCESSIBILITY_TEXT,
    minText: targetFieldDisplayText(String(CALORIES_MIN)),
    maxText: targetFieldDisplayText(String(CALORIES_MAX))
  } as const),
  Object.freeze({
    key: 'protein',
    label: MEAL_PLAN_MACRO_LABELS.protein,
    unit: MEAL_PLAN_GRAMS_UNIT,
    unitAccessibilityText: MEAL_PLAN_GRAMS_UNIT_ACCESSIBILITY_TEXT,
    minText: targetFieldDisplayText(String(MACRO_MIN)),
    maxText: targetFieldDisplayText(String(MACRO_MAX))
  } as const),
  Object.freeze({
    key: 'carbs',
    label: MEAL_PLAN_MACRO_LABELS.carbs,
    unit: MEAL_PLAN_GRAMS_UNIT,
    unitAccessibilityText: MEAL_PLAN_GRAMS_UNIT_ACCESSIBILITY_TEXT,
    minText: targetFieldDisplayText(String(MACRO_MIN)),
    maxText: targetFieldDisplayText(String(MACRO_MAX))
  } as const),
  Object.freeze({
    key: 'fat',
    label: MEAL_PLAN_MACRO_LABELS.fat,
    unit: MEAL_PLAN_GRAMS_UNIT,
    unitAccessibilityText: MEAL_PLAN_GRAMS_UNIT_ACCESSIBILITY_TEXT,
    minText: targetFieldDisplayText(String(MACRO_MIN)),
    maxText: targetFieldDisplayText(String(MACRO_MAX))
  } as const)
])

// One bar and one field per block of 34:214, so the waiting shape is the form's own rather than a generic
// placeholder the loaded screen then contradicts.
const SKELETON_BLOCK_HEIGHTS: readonly number[] = Object.freeze([
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL_LG
])

const BLANK_FIELDS: EditTargetsFields = Object.freeze({calories: '', protein: '', carbs: '', fat: ''})

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
  // What this visit switched to editing: 'confirm_estimate' once the user asked for a recalculation, or
  // 'manual_entry' once they chose to enter figures no estimate could supply. The route decides the intent
  // until one of those happens, so an override is what makes the choice outlive the press that made it.
  const [intentOverride, setIntentOverride] = useState<NutritionTargetsEditIntent | null>(null)
  // The whole save operation, which outlasts the request: a rejected revision is followed by a refetch and a
  // comparison, and the press has to stay closed for all of it or a second submission overlaps the recovery of
  // the first.
  const [isRecovering, setIsRecovering] = useState(false)

  // What the last successful save wrote. A second press on the same figures returns instead of writing them
  // again, so a failure later in the sequence cannot turn one confirmation into two revisions.
  const savedFields = useRef<EditTargetsFields | null>(null)

  // A targets read that did not answer — no server targets, a failure, or a rolled-back backend whose route is
  // gone (AAP 0.7.5) — means fall back to the local target, never clear it.
  const targets = selectNutritionTargets(targetsQuery)
  const estimate = estimateQuery.data ?? null

  const intent = intentOverride ?? resolveEditTargetsIntent({mode: params.mode, routeIntent: params.intent, targets})

  // What the editor opens on: blank on the manual route (Skip or "Prefer not to say"), the calculated estimate
  // when there is nothing saved to edit, and the saved figures otherwise.
  const openingFields = useMemo<EditTargetsFields>(() => {
    const source: MacroTargets | null =
      intent === 'manual_entry' ? null : intent === 'confirm_estimate' ? estimate : (targets?.targets ?? null)

    if (source === null) {
      return BLANK_FIELDS
    }

    return {
      calories: targetFieldText(source.calories),
      protein: targetFieldText(source.protein),
      carbs: targetFieldText(source.carbs),
      fat: targetFieldText(source.fat)
    }
  }, [estimate, intent, targets])

  const fields = enteredFields ?? openingFields
  const validation = validateEditTargets(fields)
  const errors = hasSubmitted ? validation.errors : {}

  // The manual route (Skip, or "Prefer not to say") opens on blank fields, so there is no calculated estimate
  // for the standing copy to say these figures replace — note 34:177 titles that route for the user's own
  // chosen targets instead.
  const isManualRoute = intent === 'manual_entry'

  // The estimate's two refusals are different answers and lead different ways out: "no estimate can be
  // calculated for these inputs" is a decision the server made, past which manual entry is the only route,
  // while anything else is a read that failed and can be retried.
  const isEstimateUnavailable =
    estimateQuery.isError && getApiErrorCode(estimateQuery.error) === API_ERROR_CODES.estimateUnavailable

  // Which figures each field opens on is the reads' answer, so the form waits for them rather than rendering
  // blanks that a resolved read would contradict — and withholds the save until it has a revision to pin.
  const readiness = resolveEditTargetsReadiness({
    intent,
    isTargetsLoading: targetsQuery.isLoading,
    isTargetsRouteMissing: isNutritionTargetsRouteMissing(targetsQuery),
    hasTargetsReadFailure: isNutritionTargetsReadFailure(targetsQuery),
    isEstimateLoading: estimateQuery.isLoading,
    isEstimateUnavailable,
    hasEstimateReadFailure: estimateQuery.isError && !isEstimateUnavailable,
    hasDraft: enteredFields !== null
  })

  const offersRecalculate = shouldOfferRecalculate({intent, targets, hasEstimate: estimate !== null})

  // Every affordance that writes or leaves is closed for the whole operation, not just the request.
  const isBusy = saveTargetsMutation.isPending || isRecovering

  const onChangeField = useCallback(
    (key: EditTargetsFieldKey, text: string) => {
      setEnteredFields(current => {
        const base = current ?? openingFields

        // The field's own current value is what a refused entry falls back to. sanitizeIntegerInput rejects a
        // decimal point, a sign or a malformed group outright rather than stripping the offending character,
        // so without `previous` that rejection would clear a figure the user never meant to delete.
        return {...base, [key]: sanitizeIntegerInput(text, base[key])}
      })
      // Edited figures are no longer the ones the advisory described.
      setFeasibilityBody(null)
    },
    [openingFields]
  )

  const onCancelPressed = useCallback(() => {
    returnFromTargets(params.returnTo)
  }, [params.returnTo, returnFromTargets])

  // Retries whichever read failed, never both blindly: re-running a read that answered would throw away a good
  // answer, and the route-missing answer is offered no retry at all because the next attempt is identical.
  const onRetryReadsPressed = useCallback((): void => {
    if (readiness.retryTargets) {
      targetsQuery.refetch()
    }

    if (readiness.retryEstimate) {
      estimateQuery.refetch()
    }
  }, [estimateQuery, readiness.retryEstimate, readiness.retryTargets, targetsQuery])

  // Recalculating changes what this visit saves, not just what it shows: the fields re-derive from the
  // estimate and the save becomes a confirmation of the server's own recomputed figures, which is the only
  // shape that records which inputs they came from. Retyping them by hand would store the same numbers as a
  // manual set and leave the staleness it was meant to clear in place. Dropping the draft is what hands the
  // fields back to the opening figures.
  const onRecalculatePressed = useCallback((): void => {
    setIntentOverride('confirm_estimate')
    setEnteredFields(null)
    setHasSubmitted(false)
    setFeasibilityBody(null)
  }, [])

  // No estimate can be calculated for these inputs, so the user supplies the figures: blank fields, and a save
  // that claims nothing about where the numbers came from (0.2.5).
  const onEnterManuallyPressed = useCallback((): void => {
    setIntentOverride('manual_entry')
    setEnteredFields(null)
    setHasSubmitted(false)
  }, [])

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

      setIsRecovering(true)

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
          // The refetch comes first and the draft is dropped only once it has actually answered. Dropping it is
          // what repopulates the four fields — with nothing entered they derive from the estimate query again —
          // so clearing it ahead of a refetch that then fails would destroy the user's figures and leave the
          // previous estimate, which TanStack retains, on screen presented as the recalculated one. Only the
          // title is toasted: its body tells the user to generate a plan again, which is untrue of the Account,
          // Progress and Diary entry points, none of which reaches this editor with a plan in view.
          const refreshed = await estimateQuery.refetch()

          if (!refreshed.isSuccess) {
            showToast('error', TOAST_GENERIC_ERROR)

            return
          }

          setEnteredFields(null)
          showToast('error', MEAL_PLAN_GENERATION_TERMINAL_COPY.stale_revision.title)

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

        // A refetch that failed is not an answer. TanStack resolves it with the data it was already holding, so
        // comparing against that would measure this press against figures the server may never have stored —
        // and, wherever the retained row happens to match, would report a write the server refused as one that
        // landed and leave the editor. The draft stays, the reads' own retry is what moves this forward.
        if (!refetched.isSuccess) {
          showToast('error', TOAST_GENERIC_ERROR)

          return
        }

        const fresh = selectNutritionTargets(refetched)

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
      } finally {
        setIsRecovering(false)
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

  // 'Use theirs' abandons the entered figures for the ones the server holds — and shows them, here, instead of
  // leaving. The refetch that found the conflict has already put the winning row in the cache, so dropping the
  // draft is enough for the four fields to re-derive from it, and the intent moves to the saved figures because
  // a confirmation's fields would otherwise re-derive from the estimate and show anything but "theirs". The
  // user sees what they accepted and can still edit it or cancel from the same screen; leaving would answer a
  // question about four figures with a navigation to a surface that shows a calorie total at most.
  const onUseTheirsPressed = useCallback((): void => {
    setConflictFields(null)
    setEnteredFields(null)
    setIntentOverride('edit_saved')
    setHasSubmitted(false)
    setFeasibilityBody(null)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        {/* SetupFooter handles the keyboard height; the scroll view only reveals the focused input. */}
        <ColumnScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={styles.header}>
            <BackCircleButton onPress={onCancelPressed} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

            <Text style={styles.headerLabel}>{MEAL_PLAN_REVIEW_HEADER_LABEL}</Text>
          </View>

          {/* This screen's own headline constant on either route, not frame 09's card overline: that one is
              an 11px uppercase label inside the review card, and one string serving both surfaces made a
              re-wording of either silently re-word the other. */}
          <Text style={styles.headline} accessibilityRole="header">
            {isManualRoute ? MEAL_PLAN_CHOSEN_TARGETS_TITLE : MEAL_PLAN_EDIT_TARGETS_TITLE}
          </Text>

          <Text style={styles.subCopy}>
            {isManualRoute ? MEAL_PLAN_CHOSEN_TARGETS_CAPTION : MEAL_PLAN_EDIT_TARGETS_SUBTITLE}
          </Text>

          {readiness.status === 'loading' && (
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

          {/* A read that did not answer is stated rather than rendered as empty fields, and each of the three
              says how to get past it: a failure retries, a rolled-back route cannot and says so, and an
              estimate that cannot be calculated hands over to manual entry (0.2.5). The save waits in all
              three — the payload pins the revision these reads carry. */}
          {readiness.status === 'read_failed' && (
            <View style={styles.bannerWrapper} accessibilityLiveRegion="polite">
              <InfoBanner
                tone="error"
                glyph="alert"
                title={MEAL_PLAN_LOAD_ERROR_TITLE}
                body={MEAL_PLAN_LOAD_ERROR_BODY}
                actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
                onAction={onRetryReadsPressed}
              />
            </View>
          )}

          {readiness.status === 'unavailable' && (
            <View style={styles.bannerWrapper} accessibilityLiveRegion="polite">
              <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_UNAVAILABLE_TEXT} />
            </View>
          )}

          {readiness.status === 'estimate_unavailable' && (
            <View style={styles.bannerWrapper} accessibilityLiveRegion="polite">
              <InfoBanner
                tone="error"
                glyph="alert"
                body={MEAL_PLAN_ESTIMATE_UNAVAILABLE_TITLE}
                actionLabel={MEAL_PLAN_ENTER_TARGETS_MANUALLY_BUTTON_TEXT}
                onAction={onEnterManuallyPressed}
              />
            </View>
          )}

          {readiness.showFields && (
            <>
              <View style={styles.fieldGroup}>
                {TARGET_FIELDS.map(field => {
                  const errorCode = errors[field.key]

                  // Grouped for display while the stored field keeps the bare digits the estimate comparison
                  // and the save payload are built from. Derived once and read by both the value and the
                  // character limit, so the limit can never be narrower than the figure on screen — a stored
                  // target the legacy writer accepted above this field's bound still displays in full.
                  const displayText = targetFieldDisplayText(fields[field.key])

                  // What went wrong, not merely that something did: the validator distinguishes an empty field
                  // from an unreadable one and both bounds from each other, so the message is resolved from its
                  // code rather than fixed per field. A 500 kcal entry told "above 0 kcal" is told a bound it
                  // already satisfies and never learns the floor is 800. Derived once and read by the field's
                  // name and by the row beneath it, so the two can never state different reasons.
                  const errorMessage =
                    errorCode === undefined
                      ? undefined
                      : targetFieldErrorText({
                          field: field.key,
                          code: errorCode,
                          minText: field.minText,
                          maxText: field.maxText
                        })

                  return (
                    <View key={field.key} style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>

                      <TextField
                        value={displayText}
                        onChangeText={text => onChangeField(field.key, text)}
                        placeholder={field.label}
                        unit={field.unit}
                        state={errorCode === undefined ? 'default' : 'error'}
                        keyboardType="numeric"
                        maxLength={targetFieldMaxLength(field.key, displayText)}
                        // The field names its own unit, and a field reporting an error carries the reason in
                        // its name too, so both are announced with the input and not only by the row beneath it.
                        accessibilityLabel={targetFieldAccessibilityLabel({
                          label: field.label,
                          unitText: field.unitAccessibilityText,
                          errorMessage
                        })}
                      />

                      {errorMessage !== undefined && (
                        <View accessibilityLiveRegion="polite">
                          <InlineError message={errorMessage} />
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>

              {/* The recalculated figure and the link that adopts it, shown while the saved set this editor
                  opened on is one the server calls stale, legacy or incomplete. Pressing it is the only way to
                  save these numbers as a confirmation of the server's own estimate: typing them by hand stores
                  the same figures as a manual set and leaves the staleness in place (0.5.2, 0.7.3). */}
              {offersRecalculate && estimate !== null && (
                <View style={styles.recalculateRow}>
                  <Text style={styles.recalculateLabel}>
                    {stringWithNamedParameters(MEAL_PLAN_FRESH_ESTIMATE_TEMPLATE, {
                      calories: formatCalories(estimate.calories)
                    })}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={Opacity.PRESSED}
                    hitSlop={RECALCULATE_HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_TARGETS_ACTION_ACCESSIBILITY_TEMPLATE, {
                      action: MEAL_PLAN_RECALCULATE_LINK_TEXT
                    })}
                    disabled={isBusy}
                    onPress={onRecalculatePressed}>
                    <Text style={styles.recalculateLink}>{MEAL_PLAN_RECALCULATE_LINK_TEXT}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* The advisory replaces the standing note in place, because both describe the figures above and
                  09b draws a single banner in this slot. It is announced as a status rather than an alert: the
                  save it reports on succeeded. */}
              <View style={styles.bannerWrapper} accessibilityLiveRegion={feasibilityBody === null ? 'none' : 'polite'}>
                {feasibilityBody === null ? (
                  <InfoBanner tone="success" glyph="info" body={MEAL_PLAN_MANUAL_MACROS_BANNER_BODY} />
                ) : (
                  <InfoBanner tone="neutral" glyph="info" body={feasibilityBody} />
                )}
              </View>
            </>
          )}
        </ColumnScrollView>
      </ContentColumn>

      <SetupFooter hairline>
        <PrimaryButton
          // Once an advisory is showing, the write has already committed and this press only acknowledges it
          // and leaves — the repeat guard in submitTargets recognises the unchanged figures and returns
          // without a second revision. Editing any field clears the advisory, so the label reverts with it.
          label={feasibilityBody === null ? MEAL_PLAN_SAVE_TARGETS_BUTTON_TEXT : MEAL_PLAN_DONE_BUTTON_TEXT}
          isLoading={isBusy}
          // 46:555 keeps this enabled so every press re-validates, and 34:285 is drawn enabled beside a live
          // error. It waits for two things only: the reads whose revisions pin the write, because targets sent
          // without them are refused outright, and its own operation, which outlasts the request whenever a
          // rejected revision has to be refetched and compared. An advisory press is neither — the write it
          // acknowledges already committed and the repeat guard returns without a second one — so it stays live
          // rather than trapping the user behind a read that failed after their save landed.
          disabled={isBusy || (feasibilityBody === null && !readiness.canSave)}
          onPress={onSavePressed}
        />

        <TertiaryTextButton label={CANCEL_BUTTON_TEXT} disabled={isBusy} onPress={onCancelPressed} />
      </SetupFooter>

      <ConfirmModal
        isVisible={conflictFields !== null}
        confirmationTitle={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        confirmButtonText={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        confirmButtonColor={Theme.colors.accentGreen}
        cancelButtonText={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        cancelButtonColor={Theme.colors.track}
        isConfirmPending={isBusy}
        avoidKeyboard
        onConfirmPressed={onKeepMinePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanEditTargetsScreen
