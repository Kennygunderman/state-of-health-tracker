import React, {useCallback, useEffect, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {ActivityLevel, MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {MealPlanActivityRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InfoBanner from '@components/InfoBanner'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import SetupFooter from '@components/SetupFooter'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'
import WizardHeader from '@components/WizardHeader'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ACTIVITY_INFO_BODY,
  MEAL_PLAN_ACTIVITY_LEVEL_DESCRIPTIONS,
  MEAL_PLAN_ACTIVITY_LEVEL_LABELS,
  MEAL_PLAN_ACTIVITY_SUBTITLE,
  MEAL_PLAN_ACTIVITY_TITLE,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import styles from './index.styled'

interface ActivityOption {
  value: ActivityLevel
  label: string
  subcopy: string
}

const ACTIVITY_CODES: readonly ActivityLevel[] = Object.freeze([
  'not_very_active',
  'lightly_active',
  'active',
  'very_active'
] as const)

const ACTIVITY_OPTIONS: readonly ActivityOption[] = Object.freeze(
  ACTIVITY_CODES.map(value =>
    Object.freeze({
      value,
      label: MEAL_PLAN_ACTIVITY_LEVEL_LABELS[value],
      subcopy: MEAL_PLAN_ACTIVITY_LEVEL_DESCRIPTIONS[value]
    })
  )
)

const ACTIVITY_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = ['activityLevel']

const MealPlanActivityScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanActivityRouteProp>()

  const {
    data: preferencesData,
    isLoading: isLoadingPreferences,
    refetch: refetchPreferences
  } = useMealPlanPreferencesQuery()
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, setStepFields, stepsForRoute} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. A successful save marks them stored first, so leaving after one keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('activity', params.mode === 'edit')

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesData ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  const wizardSteps = stepsForRoute('estimated')
  const showRequiredError = hasSubmitted && draft.activityLevel === null

  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

    if (params.mode === 'edit') {
      navigation.navigate(Screens.MEAL_PLAN_GOAL, {
        mode: 'edit',
        returnTo: params.returnTo,
        origin: params.origin,
        scope: 'pace'
      })

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_DIET, params)
  }, [markSaved, navigation, params])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    const activityLevel = draft.activityLevel

    if (activityLevel === null) {
      return
    }

    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveSetupStep({
        step: 'activity',
        payload: {
          activityLevel,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: saved.revision
        }
      })
    } catch (error) {
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      const refetched = await refetchPreferences()
      const fresh = refetched.data ?? null

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      const resolution = resolveStaleRevision<MealPlanPreferences>({activityLevel}, fresh, ACTIVITY_CONFLICT_FIELDS)

      if (resolution.status === 'resolved') {
        advance()

        return
      }

      setHasConflict(true)

      return
    }

    advance()
  }, [advance, draft.activityLevel, preferences, refetchPreferences, saveSetupStep])

  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

  const onSelectActivity = useCallback(
    (activityLevel: ActivityLevel) => {
      setStepFields('activity', {activityLevel})
    },
    [setStepFields]
  )

  return (
    // Screen is not the root here: its horizontal margins would compose with ContentColumn's gutter and
    // widen the content column past the width the design gives it.
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ContentColumn>
        {/* The header scrolls with the body rather than pinning above it, so every answer and the footer
            stay reachable at the largest supported text sizes. */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <WizardHeader
            step={wizardSteps.indexOf('activity') + 1}
            totalSteps={wizardSteps.length}
            onBack={navigation.goBack}
          />

          <Text style={styles.headline}>{MEAL_PLAN_ACTIVITY_TITLE}</Text>

          <Text style={styles.subcopy}>{MEAL_PLAN_ACTIVITY_SUBTITLE}</Text>

          <View style={styles.optionList} accessibilityRole="radiogroup">
            {ACTIVITY_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                label={option.label}
                subcopy={option.subcopy}
                selected={draft.activityLevel === option.value}
                onPress={() => onSelectActivity(option.value)}
              />
            ))}
          </View>

          {showRequiredError && <InlineError message={MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT} />}

          <View style={styles.infoBannerWrapper}>
            <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_ACTIVITY_INFO_BODY} />
          </View>
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={isSaving || isLoadingPreferences}
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

export default MealPlanActivityScreen
