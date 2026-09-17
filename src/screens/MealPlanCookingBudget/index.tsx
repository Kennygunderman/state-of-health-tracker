import React, {useCallback, useEffect, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import type {CookingTimeLimitMin, MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanCookingBudgetRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {weightUnitPrefFor} from '@utility/UnitConversionUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'

import CheckboxSquare from '@components/CheckboxSquare'
import ChipCloud from '@components/ChipCloud'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import PrimaryButton from '@components/PrimaryButton'
import SelectableChip from '@components/SelectableChip'
import SetupFooter from '@components/SetupFooter'
import SummaryRows from '@components/SummaryRows'
import Text from '@components/Text'
import TextField from '@components/TextField'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_BUDGET_ERROR_TEXT,
  MEAL_PLAN_BUDGET_HEADER,
  MEAL_PLAN_BUDGET_HELPER_TEXT,
  MEAL_PLAN_BUDGET_PLACEHOLDER,
  MEAL_PLAN_BUDGET_UNIT,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_COOKING_BUDGET_TITLE,
  MEAL_PLAN_COOKING_TIME_HEADER,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_ACCESSIBILITY_LABEL,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_OPTIONAL_LABEL,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_SUMMARY_HEADER,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'
import {
  buildPlanSummaryRows,
  budgetFieldState,
  COOKING_TIME_OPTIONS,
  CookingBudgetErrorCode,
  cookingBudgetWizardProgress,
  parseWeeklyBudget,
  sanitizeBudgetInput,
  validateCookingBudgetStep
} from './index.util'

// One message per code the step can report: a missing chip is the shared option-group sentence, an amount
// outside the accepted whole-dollar range is 08's own field message.
const COOKING_BUDGET_ERROR_COPY: Readonly<Record<CookingBudgetErrorCode, string>> = Object.freeze({
  option_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  budget_range: MEAL_PLAN_BUDGET_ERROR_TEXT
})

// The answers this step owns. budget is one object, compared key by key, so the same amount and currency
// never read as a difference.
const COOKING_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'cookingTimeLimitMin',
  'budget',
  'noBudgetPreference'
])

const MealPlanCookingBudgetScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanCookingBudgetRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  const {data: preferencesData, refetch: refetchPreferences} = useMealPlanPreferencesQuery()
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, dirty, seeded, seedFromPreferences, setStepFields, setBudgetAmount, setNoBudgetPreference} =
    useMealPlanSetupDraft()
  const weightUnit = useUserData(state => state.weightUnit)

  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. A successful save marks them stored first, so leaving after one keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('cooking', params.mode === 'edit')

  const [enteredBudget, setEnteredBudget] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Live only while a refetched row genuinely differs from this draft.
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesData ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      // The typed amount is kept: seeding preserves every step the user has already edited, and an amount
      // being typed is one of those edits. Releasing it here would erase a value the query happened to
      // overtake — including one that is not yet a valid amount, which the draft cannot hold and this field
      // is therefore the only record of.
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const progress = cookingBudgetWizardProgress(preferences?.targetRoute ?? null)
  const budgetText = enteredBudget ?? (draft.budget === null ? '' : String(draft.budget.amount))
  const validation = validateCookingBudgetStep(draft.cookingTimeLimitMin, draft.noBudgetPreference, budgetText)
  const shownValidation = hasSubmitted ? validation : null

  const onChangeBudget = useCallback(
    (text: string) => {
      // The field keeps what it holds when a keystroke cannot belong to a whole-dollar amount, so the
      // decimal key the numeric pad offers is refused rather than emptying the amount already entered.
      const sanitized = sanitizeBudgetInput(text, budgetText)

      setEnteredBudget(sanitized)
      // The draft carries the amount with the currency this release accepts, so the payload is never
      // assembled from a half-parsed field: an unparseable amount is no amount at all.
      setBudgetAmount(parseWeeklyBudget(sanitized))
    },
    [budgetText, setBudgetAmount]
  )

  const onToggleNoBudgetPreference = useCallback(() => {
    const next = !draft.noBudgetPreference

    setNoBudgetPreference(next)

    if (next) {
      // Checking the box is the explicit "no amount" answer, so the field goes back to its placeholder
      // rather than keeping a number the answer has just discarded.
      setEnteredBudget('')
    }
  }, [draft.noBudgetPreference, setNoBudgetPreference])

  // The step's committed hand-off, in one place so a save that completes and a rejected revision the refetch
  // proves already holds these answers leave by the identical route.
  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_TARGETS, params)
  }, [markSaved, navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (!validation.isValid || draft.cookingTimeLimitMin === null) {
      return
    }

    const cookingTimeLimitMin = draft.cookingTimeLimitMin
    const budget = draft.noBudgetPreference ? null : draft.budget

    if (budget === null && !draft.noBudgetPreference) {
      return
    }

    // The step is written against the saved row's exact revision, so a query that has not produced one — it
    // errored, or has not resolved yet — is asked again rather than sending a write the server must refuse.
    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveSetupStep({
        step: 'cooking',
        payload: {
          cookingTimeLimitMin,
          budget,
          noBudgetPreference: draft.noBudgetPreference,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: saved.revision
        }
      })
    } catch (error) {
      // Neither the chip nor the amount is cleared and the screen stays put, so the next press re-sends the
      // same step rather than asking the user to answer it again.
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): refetch the authoritative row and compare this
      // step's own answers with it. Equal values mean the write whose response was lost, or the identical
      // edit from another device, already landed — so it resolves silently instead of writing twice.
      const refetched = await refetchPreferences()
      const fresh = refetched.data ?? null

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      if (
        resolveStaleRevision<MealPlanPreferences>(
          {cookingTimeLimitMin, budget, noBudgetPreference: draft.noBudgetPreference},
          fresh,
          COOKING_CONFLICT_FIELDS
        ).status === 'resolved'
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
    draft.budget,
    draft.cookingTimeLimitMin,
    draft.noBudgetPreference,
    preferences,
    refetchPreferences,
    saveSetupStep,
    validation.isValid
  ])

  // 'Use theirs' discards this step's draft answers in favour of the refetched row. The typed amount goes with
  // them: while it is set it outranks the saved value on every render.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    setEnteredBudget(null)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

  const onSelectCookingTime = useCallback(
    (cookingTimeLimitMin: CookingTimeLimitMin) => {
      setStepFields('cooking', {cookingTimeLimitMin})
    },
    [setStepFields]
  )

  // The goal weight is shown in the unit it was answered in: the draft's, the saved row's, or — on the
  // manual route, which skips the body step entirely — the one the rest of the app already uses.
  const summaryRows = buildPlanSummaryRows(
    {draft, seeded, editedSteps: dirty, fallbackWeightUnitPref: weightUnitPrefFor(weightUnit)},
    preferences
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <WizardHeader step={progress.step} totalSteps={progress.totalSteps} onBack={navigation.goBack} />

        {/* The weekly amount sits under the chips with the summary card below it, so the scroll region
            carries the number pad's inset while the footer stays pinned outside it (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <Text style={styles.headline}>{MEAL_PLAN_COOKING_BUDGET_TITLE}</Text>

          <View style={styles.cookingSection}>
            <Text style={styles.controlLabel}>{MEAL_PLAN_COOKING_TIME_HEADER}</Text>

            {/* The four chips are one answer, so the group carries the radio semantics: a chip reports
                itself as a selected button, which alone never says that choosing one releases the rest. */}
            {/* BLITZY [A11Y]: the chips take SelectableChip's expanded pressable, which keeps the pill at the
                32px Figma draws (47:619) and reaches the 44px minimum through the host instead of hit slop a
                row hugging the pill would clip. The row renders 44px rather than the drawn 40px — the same
                deviation every other chip row in setup carries, flagged for designer review. */}
            <View style={styles.cookingChips} accessibilityRole="radiogroup">
              <ChipCloud>
                {COOKING_TIME_OPTIONS.map(option => (
                  <SelectableChip
                    key={option.value}
                    label={option.label}
                    selected={draft.cookingTimeLimitMin === option.value}
                    expandTouchTarget
                    onPress={() => onSelectCookingTime(option.value)}
                  />
                ))}
              </ChipCloud>
            </View>

            {/* Mounted whether or not it carries a message: a live region announces what changes inside it,
                so one that appears already holding its error is never read out. */}
            <View accessibilityLiveRegion="polite">
              {shownValidation?.cookingTimeError != null && (
                <InlineError message={COOKING_BUDGET_ERROR_COPY[shownValidation.cookingTimeError]} />
              )}
            </View>
          </View>

          <View style={styles.budgetSection}>
            <View style={styles.labelRow}>
              <Text style={styles.controlLabel}>{MEAL_PLAN_BUDGET_HEADER}</Text>

              <Text style={styles.optionalLabel}>{MEAL_PLAN_OPTIONAL_LABEL}</Text>
            </View>

            <View style={styles.budgetField}>
              <TextField
                value={budgetText}
                onChangeText={onChangeBudget}
                placeholder={MEAL_PLAN_BUDGET_PLACEHOLDER}
                unit={MEAL_PLAN_BUDGET_UNIT}
                state={budgetFieldState(draft.noBudgetPreference, shownValidation)}
                keyboardType="numeric"
                accessibilityLabel={MEAL_PLAN_BUDGET_HEADER}
              />
            </View>

            <View accessibilityLiveRegion="polite">
              {shownValidation?.budgetError != null && (
                <InlineError message={COOKING_BUDGET_ERROR_COPY[shownValidation.budgetError]} />
              )}
            </View>

            {/* The label answers the question as much as the box does, so the row is one checkbox: the mark
                inside it takes no touches and publishes no element of its own, leaving a single node to
                announce the state. */}
            <TouchableOpacity
              style={styles.preferenceRow}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="checkbox"
              accessibilityLabel={MEAL_PLAN_NO_BUDGET_PREFERENCE_ACCESSIBILITY_LABEL}
              accessibilityState={{checked: draft.noBudgetPreference}}
              onPress={onToggleNoBudgetPreference}>
              <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <CheckboxSquare
                  state={draft.noBudgetPreference ? 'checkedEmphasis' : 'unchecked'}
                  accessibilityLabel={MEAL_PLAN_NO_BUDGET_PREFERENCE_ACCESSIBILITY_LABEL}
                  onPress={onToggleNoBudgetPreference}
                />
              </View>

              <Text style={styles.preferenceLabel}>{MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>{MEAL_PLAN_BUDGET_HELPER_TEXT}</Text>

          {summaryRows.length > 0 && (
            <View style={styles.summaryCardWrapper}>
              <View style={styles.summaryCard}>
                <SummaryRows rows={summaryRows} overline={MEAL_PLAN_SUMMARY_HEADER} />
              </View>
            </View>
          )}
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

export default MealPlanCookingBudgetScreen
