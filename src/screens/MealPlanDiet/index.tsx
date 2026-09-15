import React, {useCallback, useEffect, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {Diet, MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanDietRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ChipCloud from '@components/ChipCloud'
import ContentColumn from '@components/ContentColumn'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
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
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
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

  const preferencesQuery = useMealPlanPreferencesQuery()
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, selectAllergen} = useMealPlanSetupDraft()

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

  const advance = useCallback((): void => {
    setHasConflict(false)

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_FOOD_PREFERENCES, params)
  }, [navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (errorCodes.length > 0 || draft.diet === null) {
      return
    }

    // The server rejects a step save that does not name the exact revision it builds on, so a press that
    // finds no row asks for one before writing. The CTA is disabled while the query is in flight, so the only
    // way to arrive here without a row is the failed fetch 0.2.5 hands back to Continue — the draft is intact
    // either way, and a refetch that still returns nothing reports rather than writes blind.
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
      const fresh = refetched.data ?? null

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
    seedFromPreferences(preferences)
  }, [preferences, seedFromPreferences])

  const onSelectDiet = useCallback(
    (diet: Diet) => {
      setStepFields('diet', {diet})
    },
    [setStepFields]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <WizardHeader step={progress.step} totalSteps={progress.totalSteps} onBack={navigation.goBack} />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.headline} accessibilityRole="header">
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

          {errors.includes('diet_required') && <InlineError message={DIET_ERROR_COPY.diet_required} />}

          <Text style={styles.sectionLabel}>{MEAL_PLAN_ALLERGIES_HEADER}</Text>

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

          {allergenErrorCode !== undefined && <InlineError message={DIET_ERROR_COPY[allergenErrorCode]} />}

          <Text style={styles.helperText}>{MEAL_PLAN_ALLERGIES_HELPER_TEXT}</Text>
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={saveStepMutation.isPending}
          // Enabled on arrival and validating on press (0.7.4) the moment the row this save must name is
          // readable; until the first fetch settles there is no revision to build on.
          disabled={preferencesQuery.isLoading}
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

export default MealPlanDietScreen
