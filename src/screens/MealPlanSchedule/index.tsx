import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {MealPlanPreferences, MealSchedule} from '@data/models/MealPlanPreferences'
import type {MealSlot} from '@data/models/Recipe'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {MealPlanScheduleRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {formatSlotTime} from '@utility/MealPlanDateUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import {closeGlobalBottomSheet, openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import InlineError from '@components/InlineError'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import OptionCard from '@components/OptionCard'
import Picker from '@components/Picker'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
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
  MEAL_PLAN_USUAL_TIMES_HEADER,
  MEAL_SLOT_LABELS,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import DashedPlaceholder from './components/DashedPlaceholder'
import TimeRow from './components/TimeRow'
import styles from './index.styled'
import {
  buildMealTimePickerItems,
  buildMealTimesPayload,
  mealSlotsForSchedule,
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

  const preferencesQuery = useMealPlanPreferencesQuery()
  const saveStepMutation = useSaveSetupStepMutation()
  const {draft, seeded, seedFromPreferences, selectMealSchedule, setMealTime, stepsForRoute} = useMealPlanSetupDraft()

  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Live only while a refetched row genuinely differs from this draft.
  const [hasConflict, setHasConflict] = useState(false)

  const preferences = preferencesQuery.data ?? null

  useEffect(() => {
    if (!seeded && preferences !== null) {
      seedFromPreferences(preferences)
    }
  }, [preferences, seedFromPreferences, seeded])

  // 96 quarter-hour options, built once: the list is identical for every slot and rebuilding it per sheet
  // would recompute the same 96 labels on each open.
  const pickerItems = useMemo(() => buildMealTimePickerItems(), [])

  const wizardSteps = stepsForRoute(preferences?.targetRoute ?? 'estimated')
  const slots = mealSlotsForSchedule(draft.mealSchedule)
  const scheduleError = hasSubmitted ? validateMealScheduleStep(draft.mealSchedule) : null

  const timeFor = useCallback(
    (slot: MealSlot): string => draft.mealTimes.find(entry => entry.slot === slot)?.time ?? '',
    [draft.mealTimes]
  )

  // The step's committed hand-off, in one place so a save that completes and a rejected revision the refetch
  // proves already holds this schedule leave by the identical route.
  const advance = useCallback((): void => {
    setHasConflict(false)

    if (params.mode === 'edit') {
      returnFromTargets({kind: 'stack', route: params.returnTo})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_COOKING_BUDGET, params)
  }, [navigation, params, returnFromTargets])

  const onContinuePressed = useCallback(async (): Promise<void> => {
    setHasSubmitted(true)

    if (validateMealScheduleStep(draft.mealSchedule) !== null || draft.mealSchedule === null) {
      return
    }

    const mealSchedule = draft.mealSchedule
    const mealTimes = buildMealTimesPayload(mealSchedule, draft.mealTimes)

    try {
      await saveStepMutation.mutateAsync({
        step: 'schedule',
        payload: {
          mealSchedule,
          mealTimes,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          expectedRevision: preferences?.revision
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
      const refetched = await preferencesQuery.refetch()
      const fresh = refetched.data ?? null

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
  }, [advance, draft.mealSchedule, draft.mealTimes, preferences?.revision, preferencesQuery, saveStepMutation])

  // 'Use theirs' discards this step's draft answers in favour of the refetched row; every other step's edits
  // survive, because seeding reads the whole saved row.
  const onUseTheirsPressed = useCallback((): void => {
    setHasConflict(false)
    seedFromPreferences(preferences)
  }, [preferences, seedFromPreferences])

  const timeSheetContent = (slot: MealSlot): React.JSX.Element => (
    <View style={styles.sheetContent}>
      <Text style={styles.sheetTitle}>{MEAL_SLOT_LABELS[slot]}</Text>

      <Picker
        items={pickerItems}
        initialValue={timeFor(slot)}
        onValueSet={value => {
          setMealTime(slot, String(value))
          closeGlobalBottomSheet()
        }}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <WizardHeader
          step={wizardSteps.indexOf('schedule') + 1}
          totalSteps={wizardSteps.length}
          onBack={navigation.goBack}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.headline}>{MEAL_PLAN_SCHEDULE_TITLE}</Text>

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

          {scheduleError !== null && <InlineError message={scheduleError} />}

          {slots.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>{MEAL_PLAN_USUAL_TIMES_HEADER}</Text>

              <View style={styles.timesCardWrapper}>
                <View style={styles.timesCard}>
                  {slots.map((slot, index) => (
                    <TimeRow
                      key={slot}
                      slot={slot}
                      name={MEAL_SLOT_LABELS[slot]}
                      time={formatSlotTime(timeFor(slot))}
                      isFirst={index === 0}
                      onPress={() => openGlobalBottomSheet(timeSheetContent(slot))}
                    />
                  ))}
                </View>
              </View>

              {!slots.includes(SNACK_SLOT) && (
                <View style={styles.placeholderWrapper}>
                  <DashedPlaceholder message={MEAL_PLAN_SNACK_PLACEHOLDER_TEXT} />
                </View>
              )}

              <Text style={styles.footnote}>{MEAL_PLAN_SCHEDULE_FOOTNOTE}</Text>
            </>
          )}
        </ScrollView>
      </ContentColumn>

      <SetupFooter>
        <PrimaryButton
          label={params.mode === 'edit' ? MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT : MEAL_PLAN_CONTINUE_BUTTON_TEXT}
          isLoading={saveStepMutation.isPending}
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

export default MealPlanScheduleScreen
