import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {View} from 'react-native'

import type {MealPlanPreferences, MealSchedule} from '@data/models/MealPlanPreferences'
import type {MealSlot} from '@data/models/Recipe'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {MealPlanScheduleRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {authoritativeRefetch, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ColumnScrollView from '@components/ColumnScrollView'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import {closeGlobalBottomSheet, openGlobalBottomSheet} from '@components/GlobalBottomSheet'
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
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_SCHEDULE_FOOTNOTE,
  MEAL_PLAN_SCHEDULE_LABELS,
  MEAL_PLAN_SCHEDULE_TITLE,
  MEAL_PLAN_SNACK_PLACEHOLDER_TEXT,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_TIME_PICKER_PLACEHOLDER,
  MEAL_PLAN_USUAL_TIMES_HEADER,
  MEAL_SLOT_LABELS,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import DashedPlaceholder from './components/DashedPlaceholder'
import TimeDropdown from './components/TimeDropdown'
import TimeRow from './components/TimeRow'
import styles from './index.styled'
import {
  buildMealTimePickerItems,
  buildMealTimesPayload,
  mealSlotsForScheduleCard,
  mealTimePillLabel,
  validateMealScheduleStep
} from './index.util'

// The two schedules in the order 47:471 draws them.
const SCHEDULE_ORDER: readonly MealSchedule[] = Object.freeze(['three', 'three_plus_snack'] as const)

const SNACK_SLOT: MealSlot = 'snack'

// The answers this step owns. mealTimes is compared entry by entry in its wire order, which is the order
// this screen and the server both write it in, so an identical schedule never reads as a difference.
const SCHEDULE_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze([
  'mealSchedule',
  'mealTimes'
])

const MealPlanScheduleScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanScheduleRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const {data: preferencesData, refetch: refetchPreferences} = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const {isPending: isSaving, mutateAsync: saveSetupStep} = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, selectMealSchedule, setMealTime, stepsForRoute} = useMealPlanSetupDraft()
  // In edit mode the header back button is Cancel (0.7.4), so this step's unsaved edits are discarded by
  // whichever exit the user takes — including the iOS swipe and Android system back, which reach no
  // handler. A successful save marks them stored first, so leaving after one keeps them.
  const {markSaved, discardEdits} = useSetupStepEdit('schedule', params.mode === 'edit')

  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Live only while a refetched row genuinely differs from this draft.
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesData ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  // 96 quarter-hour options, built once: the list is identical for every slot and rebuilding it per sheet
  // would recompute the same 96 labels on each open.
  const pickerItems = useMemo(() => buildMealTimePickerItems(), [])

  const wizardSteps = stepsForRoute(preferences?.targetRoute ?? 'estimated')
  const cardSlots = mealSlotsForScheduleCard(draft.mealSchedule)
  // Computed every render, shown only once Continue has been pressed (0.7.4: errors appear on press, never
  // before), and read by both the error rows and the gate below so the two can never disagree.
  const validation = validateMealScheduleStep(draft.mealSchedule, draft.mealTimes)
  const scheduleError = hasSubmitted ? validation.scheduleError : null
  const slotTimeErrors = hasSubmitted ? validation.slotTimeErrors : []

  const timeFor = useCallback(
    (slot: MealSlot): string => draft.mealTimes.find(entry => entry.slot === slot)?.time ?? '',
    [draft.mealTimes]
  )

  // The step's committed hand-off, in one place so a save that completes and a rejected revision the refetch
  // proves already holds this schedule leave by the identical route.
  const advance = useCallback((): void => {
    setHasConflict(false)
    // Stored now, so the discard this screen performs on its way out has nothing to take back.
    markSaved()

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_COOKING_BUDGET, params)
  }, [markSaved, navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    // The step's own answers are complete before anything is sent: a slot of the chosen schedule with no
    // usable time would otherwise be written as an empty time the server can only refuse with a generic
    // 400, and the user would be told nothing about which time is missing.
    if (!validateMealScheduleStep(draft.mealSchedule, draft.mealTimes).isValid || draft.mealSchedule === null) {
      return
    }

    const mealSchedule = draft.mealSchedule
    const mealTimes = buildMealTimesPayload(mealSchedule, draft.mealTimes)

    // The step is written against the saved row's exact revision, so a query that has not produced one — it
    // errored, or has not resolved yet — is asked again rather than sending a write the server must refuse.
    const saved = preferences ?? (await refetchPreferences()).data ?? null

    if (saved === null) {
      showToast('error', TOAST_GENERIC_ERROR)

      return
    }

    try {
      await saveSetupStep({
        step: 'schedule',
        payload: {
          mealSchedule,
          mealTimes,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: saved.revision
        }
      })
    } catch (error) {
      // The chosen schedule and every edited time stay on screen, and nothing navigates away from a save
      // the server has not acknowledged.
      if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // A rejected revision is never retried blindly (0.7.2): refetch the authoritative row and compare this
      // step's own answers with it. Equal values mean the write whose response was lost, or the identical
      // edit from another device, already landed — so it resolves silently instead of writing twice.
      const refetched = await refetchPreferences()
      const fresh = authoritativeRefetch(refetched)

      if (fresh === null) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      if (
        resolveStaleRevision<MealPlanPreferences>({mealSchedule, mealTimes}, fresh, SCHEDULE_CONFLICT_FIELDS).status ===
        'resolved'
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
  }, [advance, draft.mealSchedule, draft.mealTimes, preferences, refetchPreferences, saveSetupStep])

  // 'Use theirs' discards this step's draft answers in favour of the refetched row; every other step's edits
  // survive, because seeding reads the whole saved row.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    // Seeding adopts the refetched row without overwriting a step the user has edited, which is what
    // protects the other steps — so this step's own edits have to be dropped explicitly for the row to
    // be what 'Use theirs' leaves behind.
    seedFromPreferences(preferences)
    discardEdits()
  }, [discardEdits, preferences, seedFromPreferences])

  const timeSheetContent = (slot: MealSlot): React.JSX.Element => (
    <View style={styles.sheetContent}>
      <Text style={styles.sheetTitle}>{MEAL_SLOT_LABELS[slot]}</Text>

      {/* Keyed by slot: Picker seeds its value from initialValue on mount only, and the sheet keeps one
          mounted view, so an unkeyed element would reopen still showing the previously edited pill's time. */}
      <TimeDropdown
        key={slot}
        items={pickerItems}
        placeholder={MEAL_PLAN_TIME_PICKER_PLACEHOLDER}
        value={timeFor(slot)}
        onSelect={value => {
          setMealTime(slot, String(value))
          closeGlobalBottomSheet()
        }}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        {/* Reopened from a Review or Plan settings row this screen is one step on its own, so it carries the
            back button alone: the segments and the "n of m" counter state setup-flow progress (0.7.4). */}
        <WizardHeader
          step={wizardSteps.indexOf('schedule') + 1}
          totalSteps={wizardSteps.length}
          onBack={navigation.goBack}
          isProgressVisible={params.mode !== 'edit'}
        />

        <ColumnScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.headline} accessibilityRole="header">
            {MEAL_PLAN_SCHEDULE_TITLE}
          </Text>

          <View style={styles.optionGroup} accessibilityRole="radiogroup">
            {SCHEDULE_ORDER.map(schedule => (
              <OptionCard
                key={schedule}
                label={MEAL_PLAN_SCHEDULE_LABELS[schedule]}
                selected={draft.mealSchedule === schedule}
                onPress={() => selectMealSchedule(schedule)}
              />
            ))}
          </View>

          {/* Mounted whether or not it carries a message: a live region announces what changes inside it,
              so one that appears already holding its error is never read out. */}
          <View accessibilityLiveRegion="polite">
            {scheduleError !== null && <InlineError message={scheduleError} />}
          </View>

          {/* The card is not conditional on an answer. Frame 47:471 draws it, the dashed snack placeholder
              and the footnote on a screen with nothing selected, and AAP 0.7.4 opens this step that way, so
              gating it on a chosen schedule would hide what the day looks like and what the snack option
              adds until after the choice they inform. Every pill opens the picker from first entry; an
              unseeded one reads as the action it offers rather than as a time already chosen. */}
          <Text style={styles.sectionLabel}>{MEAL_PLAN_USUAL_TIMES_HEADER}</Text>

          <View style={styles.timesCardWrapper}>
            <View style={styles.timesCard}>
              {cardSlots.map((slot, index) => (
                <TimeRow
                  key={slot}
                  slot={slot}
                  name={MEAL_SLOT_LABELS[slot]}
                  time={mealTimePillLabel(timeFor(slot))}
                  isFirst={index === 0}
                  onPress={() => openGlobalBottomSheet(timeSheetContent(slot), 480)}
                />
              ))}
            </View>
          </View>

          {!cardSlots.includes(SNACK_SLOT) && (
            <View style={styles.placeholderWrapper}>
              <DashedPlaceholder message={MEAL_PLAN_SNACK_PLACEHOLDER_TEXT} />
            </View>
          )}

          {/* One row per slot of the chosen schedule whose time is missing or unsendable, all of them at once
              (0.7.4), below the times card whose pills they name — the dashed placeholder belongs to that card
              and stays attached to it. Mounted whether or not it carries messages, for the reason the schedule
              region above is. */}
          <View accessibilityLiveRegion="polite">
            {slotTimeErrors.map(error => (
              <InlineError key={error.slot} message={error.message} />
            ))}
          </View>

          <Text style={styles.footnote}>{MEAL_PLAN_SCHEDULE_FOOTNOTE}</Text>
        </ColumnScrollView>
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

export default MealPlanScheduleScreen
