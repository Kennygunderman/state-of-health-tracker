import React, {useCallback, useEffect, useRef, useState} from 'react'

import {AccessibilityInfo, Platform, ScrollView, View} from 'react-native'

import type {Diet, MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {MealPlanDietRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ChipCloud from '@components/ChipCloud'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import SelectableChip from '@components/SelectableChip'
import SetupFooter from '@components/SetupFooter'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ALLERGIES_ERROR_TEXT,
  MEAL_PLAN_ALLERGIES_EXCLUSIVE_ERROR_TEXT,
  MEAL_PLAN_ALLERGIES_HEADER,
  MEAL_PLAN_ALLERGIES_HELPER_TEXT,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_DIET_TITLE,
  MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'
import {buildAllergenChips, DIET_OPTIONS, dietWizardProgress, DietStepErrorCode, validateDietStep} from './index.util'

// The allergy group carries the inferred sentence 0.7.4 names for it; the diet cards fall back to the
// option-group message every wizard step shares.
const DIET_ERROR_COPY: Readonly<Record<DietStepErrorCode, string>> = Object.freeze({
  diet_required: MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  allergens_required: MEAL_PLAN_ALLERGIES_ERROR_TEXT,
  // The contradiction the saved step refuses: None means "no allergies", so it cannot travel beside a named
  // one. The copy names the choice rather than the code.
  allergens_exclusive: MEAL_PLAN_ALLERGIES_EXCLUSIVE_ERROR_TEXT
})

// The codes the allergy group raises. They are mutually exclusive — an empty selection cannot also contradict
// itself — so the group renders whichever one is live in the one error slot beneath the chips.
const ALLERGEN_ERROR_CODES: readonly DietStepErrorCode[] = Object.freeze(['allergens_required', 'allergens_exclusive'])

// The answers this step owns. A rejected revision compares only these, so a diet saved here is never
// reported as conflicting with a meal time someone edited on another device.
const DIET_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze(['diet', 'allergens'])

const MealPlanDietScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanDietRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const preferencesQuery = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, selectAllergen} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. A successful save marks them stored first, so leaving after one keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('diet', params.mode === 'edit')

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesQuery.data ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const progress = dietWizardProgress(preferences?.targetRoute ?? null)
  const errorCodes = validateDietStep(draft.diet, draft.allergens)
  const errors = hasSubmitted ? errorCodes : []
  const allergenErrorCode = errors.find(code => ALLERGEN_ERROR_CODES.includes(code))
  const allergenChips = buildAllergenChips(draft.allergens)
  const dietErrorMessage = errors.includes('diet_required') ? DIET_ERROR_COPY.diet_required : null
  const allergenErrorMessage = allergenErrorCode === undefined ? null : DIET_ERROR_COPY[allergenErrorCode]

  // Each group's visible heading carries that group's live error as well — the screen headline for the diet
  // cards, the section label for the allergy chips — so a user who arrives at either question after pressing
  // Continue still hears what is wrong with it; the row beneath each group announces itself once, at the
  // moment validation runs.
  const dietGroupAccessibilityLabel =
    dietErrorMessage === null
      ? MEAL_PLAN_DIET_TITLE
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_DIET_TITLE,
          message: dietErrorMessage
        })
  const allergenGroupAccessibilityLabel =
    allergenErrorMessage === null
      ? MEAL_PLAN_ALLERGIES_HEADER
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_ALLERGIES_HEADER,
          message: allergenErrorMessage
        })

  const announcedError = useRef<string | null>(null)

  useEffect(() => {
    // Validation runs on press while focus stays on the CTA, so nothing moves the screen reader to the rows
    // below. iOS honours neither half of their markup — `accessibilityLiveRegion` is Android-only in RN 0.86,
    // and `accessibilityRole="alert"` sets traits on a view that deliberately lacks `accessible` so it cannot
    // swallow the cards and chips it wraps — so the reason is announced here instead, and Android is left to
    // its live regions rather than told twice. The topmost live message speaks; the ref keeps a re-render from
    // repeating it and clears when the errors do, so fixing and re-breaking an answer announces again.
    const announcement = dietErrorMessage ?? allergenErrorMessage

    if (announcement === null) {
      announcedError.current = null

      return
    }

    if (announcement === announcedError.current) {
      return
    }

    announcedError.current = announcement

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(announcement)
    }
  }, [allergenErrorMessage, dietErrorMessage])

  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_FOOD_PREFERENCES, params)
  }, [markSaved, navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (errorCodes.length > 0 || draft.diet === null) {
      return
    }

    // The server rejects a step save that does not name the exact revision it builds on, so a press that
    // finds no row asks for one before writing. The CTA stays enabled throughout the read (0.7.4), so a press
    // can land here before the first fetch settles as well as after one fails — the draft is intact either
    // way, and a refetch that still returns nothing reports rather than writes blind.
    const revision = preferences?.revision ?? (await preferencesQuery.refetch()).data?.revision ?? null

    if (revision === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveStepMutation.mutateAsync({
        step: 'diet',
        payload: {
          diet: draft.diet,
          allergens: draft.allergens,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: revision
        }
      })
    } catch (error) {
      // The selections stay exactly as chosen and nothing navigates: an allergy list is the one answer a
      // silent partial save must never leave the user guessing about.
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): the authoritative row is refetched and this
      // step's own answers are compared with it field by field. Equal values mean the write this client
      // lost the response to, or the identical edit from another device, already landed — so it resolves
      // silently rather than reporting a conflict or writing a second time.
      const refetched = await preferencesQuery.refetch()
      const fresh = authoritativeRefetch(refetched)

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      if (
        resolveStaleRevision<MealPlanPreferences>(
          {diet: draft.diet, allergens: draft.allergens},
          fresh,
          DIET_CONFLICT_FIELDS
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
    draft.allergens,
    draft.diet,
    errorCodes.length,
    preferences?.revision,
    preferencesQuery,
    saveStepMutation
  ])

  // 'Use theirs' discards this step's draft answers in favour of the refetched row; the seeding effect
  // above holds every other step's edits, because seeding reads the whole saved row.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

  const onSelectDiet = useCallback(
    (diet: Diet) => {
      setStepFields('diet', {diet})
    },
    [setStepFields]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        {/* Reopened from a Review or Plan settings row this screen is one step on its own, so it carries the
            back button alone: the segments and the "n of m" counter state setup-flow progress (0.7.4). */}
        <WizardHeader
          step={progress.step}
          totalSteps={progress.totalSteps}
          onBack={navigation.goBack}
          isProgressVisible={params.mode !== 'edit'}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* The headline is the diet group's visible heading and, unlike the group's wrapper, a real
              accessibility element: a `View` becomes one only with `accessible`, which here would collapse
              the four radios into a single node and hide them. So the error rides on the heading — the same
              treatment the allergy error gets on its section label below. */}
          <Text style={styles.headline} accessibilityRole="header" accessibilityLabel={dietGroupAccessibilityLabel}>
            {MEAL_PLAN_DIET_TITLE}
          </Text>

          <View style={styles.dietGroup} accessibilityRole="radiogroup">
            {DIET_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={draft.diet === option.value}
                onPress={() => onSelectDiet(option.value)}
              />
            ))}
          </View>

          {/* Mounted whether or not there is a message: a live region announces a change inside a view the
              screen reader is already watching, so a region inserted together with its text announces
              nothing. It carries no `accessible`, so the message stays its own element rather than being
              merged into one node with the cards above. */}
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            {dietErrorMessage !== null && <InlineError message={dietErrorMessage} />}
          </View>

          <Text style={styles.sectionLabel} accessibilityLabel={allergenGroupAccessibilityLabel}>
            {MEAL_PLAN_ALLERGIES_HEADER}
          </Text>

          <View style={styles.cloudWrapper}>
            <ChipCloud>
              {allergenChips.map(chip => (
                <SelectableChip
                  key={chip.code}
                  label={chip.label}
                  selected={chip.selected}
                  removable={chip.removable}
                  expandTouchTarget
                  onPress={() => selectAllergen(chip.code)}
                />
              ))}
            </ChipCloud>
          </View>

          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            {allergenErrorMessage !== null && <InlineError message={allergenErrorMessage} />}
          </View>

          <Text style={styles.helperText}>{MEAL_PLAN_ALLERGIES_HELPER_TEXT}</Text>
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        {/* Enabled throughout the preferences read: 0.7.4 gives setup one validation rule — the CTA stays
            enabled and validates on press — and reserves disabling for a pending write. A press that lands
            before the first fetch settles asks for the revision it must name and reports if none arrives. */}
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={saveStepMutation.isPending}
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
        isConfirmPending={saveStepMutation.isPending}
        avoidKeyboard
        onConfirmPressed={onContinuePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanDietScreen
