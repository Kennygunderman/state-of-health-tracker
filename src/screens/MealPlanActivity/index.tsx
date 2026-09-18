import React, {useCallback, useEffect, useRef, useState} from 'react'

import {AccessibilityInfo, Platform, ScrollView, View} from 'react-native'

import type {ActivityLevel, MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {MealPlanActivityRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import InfoBanner from '@components/InfoBanner'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft, useSetupStepEdit} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import PrimaryButton from '@components/PrimaryButton'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
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
  MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  stringWithNamedParameters,
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

// One block per option card, so the pending read occupies the space the cards will take rather than
// collapsing the screen. `CONTROL_LG` is the control-sized block the wizard's other read state is built from;
// a shimmer placeholder stands in for the card, it does not reproduce its height.
const SKELETON_BLOCK_HEIGHTS: readonly number[] = Object.freeze([
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG
])

const MealPlanActivityScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanActivityRouteProp>()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  // The read's in-flight flag drives the body and nothing else. 0.7.4 gives setup one validation rule — the
  // CTA stays enabled and validates on press — so this flag never reaches the footer, where it would both
  // block Continue and stand in for a save that has not started; 0.2.5 still asks the body to show the read,
  // which is what the skeleton below does. The press path asks for the row it needs through
  // `refetchPreferences`.
  const {
    data: preferencesData,
    isLoading: isLoadingPreferences,
    refetch: refetchPreferences
  } = useMealPlanPreferencesQuery(isGatedRequestAllowed)
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
  const activityErrorMessage = showRequiredError ? MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT : null

  // The heading carries the group's live error as well, so a user who arrives at the question after pressing
  // Continue still hears what is wrong with it; the row beneath the cards announces itself once, at the
  // moment validation runs.
  const activityGroupAccessibilityLabel =
    activityErrorMessage === null
      ? MEAL_PLAN_ACTIVITY_TITLE
      : stringWithNamedParameters(MEAL_PLAN_FIELD_ERROR_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_ACTIVITY_TITLE,
          message: activityErrorMessage
        })

  const announcedError = useRef<string | null>(null)

  useEffect(() => {
    // Validation runs on press while focus stays on the CTA, so nothing moves the screen reader to the row
    // below. iOS honours neither half of that row's markup — `accessibilityLiveRegion` is Android-only in
    // RN 0.86, and `accessibilityRole="alert"` sets traits on a view that deliberately lacks `accessible` so
    // it cannot swallow the cards it sits beside — so the reason is announced here instead, and Android is
    // left to its live region rather than told twice. The ref keeps a re-render from repeating it and clears
    // when the error does, so choosing an option and pressing Continue empty again announces afresh.
    if (activityErrorMessage === null) {
      announcedError.current = null

      return
    }

    if (activityErrorMessage === announcedError.current) {
      return
    }

    announcedError.current = activityErrorMessage

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(activityErrorMessage)
    }
  }, [activityErrorMessage])

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
      const fresh = authoritativeRefetch(refetched)

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

          {/* The headline is the group's visible heading and, unlike the option list's wrapper, a real
              accessibility element: a `View` becomes one only with `accessible`, which here would collapse
              the four radios into a single node and hide them. So the error rides on the heading, where a
              screen reader can still reach it once the announcement has passed. */}
          <Text style={styles.headline} accessibilityLabel={activityGroupAccessibilityLabel}>
            {MEAL_PLAN_ACTIVITY_TITLE}
          </Text>

          <Text style={styles.subcopy}>{MEAL_PLAN_ACTIVITY_SUBTITLE}</Text>

          {/* The saved answer decides which card reads as selected, so the list waits for it rather than
              showing an unselected state it would then contradict (0.2.5). The error row below stays mounted
              throughout, because the CTA is live during the read and a press with nothing chosen has to
              report itself even while this skeleton is showing. */}
          {isLoadingPreferences ? (
            <View style={styles.skeletonGroup} accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
              {SKELETON_BLOCK_HEIGHTS.map((height, index) => (
                <SkeletonBlock
                  key={`${height}-${index}`}
                  height={height}
                  // The stretch style overrides this, but Skeleton measures its shimmer sweep from the prop,
                  // so the column's own maximum is the width the animation is sized against.
                  width={Sizes.CONTENT_MAX_WIDTH}
                  borderRadius={BorderRadius.ITEM}
                  style={styles.skeletonStretch}
                />
              ))}
            </View>
          ) : (
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
          )}

          {/* Mounted whether or not there is a message: a live region announces a change inside a view the
              screen reader is already watching, so a region inserted together with its text announces
              nothing. It carries no `accessible`, so the message stays its own element rather than being
              merged into one node with the cards above. */}
          <View accessibilityLiveRegion="polite" accessibilityRole="alert">
            {activityErrorMessage !== null && <InlineError message={activityErrorMessage} />}
          </View>

          <View style={styles.infoBannerWrapper}>
            {/* This body is the AAP 0.1.4 copy replacement for node `47:95`, not the sentence the frame draws; the
                activity policy behind it is recorded beside the constant in strings.ts. */}
            <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_ACTIVITY_INFO_BODY} />
          </View>
        </ScrollView>
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

export default MealPlanActivityScreen
