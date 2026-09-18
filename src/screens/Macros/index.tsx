import React from 'react'

import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native'

import {DailyMacros} from '@data/models/DailyMacros'
import {Meal} from '@data/models/Meal'
import {MealEntry} from '@data/models/MealEntry'
import {useMealPlanEntitlement} from '@hooks/mealPlanning/useMealPlanEntitlement'
import {Navigation} from '@navigation/types'
import {useDailyMacrosQuery} from '@queries/macros/useDailyMacrosQuery'
import {useDeleteMealEntryMutation} from '@queries/macros/useDeleteMealEntryMutation'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {resolveTargetAuthority} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useNavigation} from '@react-navigation/native'
import {isLogWithAiEnabled} from '@service/remoteConfig/initRemoteConfig'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore, {MacrosSegment} from '@store/mealPlan/useMealPlanStore'
import {useSessionStore} from '@store/session/useSessionStore'
import useUserDataStore from '@store/userData/useUserData'
import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import ListSwipeItemManager from '@utility/ListSwipeItemManager'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {SafeAreaView} from 'react-native-safe-area-context'

import HistoryIcon from '@components/icons/HistoryIcon'
import SegmentedControl, {SegmentedControlOption} from '@components/SegmentedControl'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {DIARY_SEGMENT_LABEL, MACROS_TITLE, MEAL_PLAN_SEGMENT_LABEL, TOAST_GENERIC_ERROR} from '@constants/strings'

import DailySummaryCard from './components/DailySummaryCard'
import LogWithAICard from './components/LogWithAICard'
import MacrosSkeleton from './components/MacrosSkeleton'
import MealCard from './components/MealCard'
import MealPlanTab from './components/MealPlanTab'
import styles from './index.styled'
import {resolveAuthoritativeMacroTargets, resolveMacrosBodyKey} from './index.util'

const listSwipeItemManager = new ListSwipeItemManager()

const HISTORY_ICON_SIZE = 22
const HISTORY_ICON_STROKE_WIDTH = 2
const CROSS_DISSOLVE_DURATION_MS = 250

const MACROS_SEGMENTS: SegmentedControlOption<MacrosSegment>[] = [
  {key: 'diary', label: DIARY_SEGMENT_LABEL},
  {key: 'mealPlan', label: MEAL_PLAN_SEGMENT_LABEL}
]

const MacrosScreen = () => {
  const navigation = useNavigation<Navigation>()

  const dateIso = useSessionStore(state => state.sessionStartDateIso)
  const fallbackTargetCalories = useUserDataStore(state => state.targetCalories)
  const macrosSegment = useMealPlanStore(state => state.macrosSegment)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  const isAuthed = useAuthStore(state => state.isAuthed)

  const {isSegmentedControlVisible} = useMealPlanEntitlement()

  // No extra request: `useMealPlanEntitlement` above already observes this key, so this is a second observer of
  // the same cache entry. The authority is resolved here, not in the card, because the local target and the
  // macros answer's own figure are both in hand here; the card reads the same decision from the same query for
  // its editor routing, so the figure it displays and the editor it opens cannot disagree.
  const nutritionTargetsRead = useNutritionTargetsQuery()

  const targetAuthority = resolveTargetAuthority({read: nutritionTargetsRead, isAuthed})

  const {mutateAsync: deleteMealEntry} = useDeleteMealEntryMutation(dateIso)

  const eyebrowDate = formatIsoDayMonthDay(dateIso)

  // Forcing the diary body while the control is hidden keeps a segment the user can no longer see from
  // stranding them on it if the feature is turned off mid-session
  const isDiarySegment = !isSegmentedControlVisible || macrosSegment === 'diary'

  // Gated on the segment so the hidden diary is not refetched behind the plan body; the cache entry survives,
  // so switching back renders the cached day and only the first uncached read shows the skeleton
  const {data: dailyMacros, isLoading, isError, refetch} = useDailyMacrosQuery(dateIso, isDiarySegment)

  const isDiaryLoading = isDiarySegment && isLoading

  const goToHistory = () => navigation.push(Screens.MACROS_HISTORY)

  const goToLogWithAI = () => navigation.push(Screens.LOG_WITH_AI)

  const goToAddFood = (meal: Meal) => navigation.push(Screens.ADD_FOOD, {mealId: meal.id, mealName: meal.name})

  const goToEntryDetail = (meal: Meal, entry: MealEntry) =>
    navigation.push(Screens.FOOD_DETAIL_SCREEN, {path: 'update', mealId: meal.id, mealName: meal.name, entry})

  const onDeleteEntryPressed = async (entryId: string) => {
    try {
      await deleteMealEntry(entryId)
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  const renderHeader = () => (
    <>
      <TouchableOpacity style={styles.dateOverlineTouchable} activeOpacity={Opacity.PRESSED} onPress={goToHistory}>
        <Text style={styles.dateOverline}>{eyebrowDate}</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>{MACROS_TITLE}</Text>

        <TouchableOpacity style={styles.historyButton} activeOpacity={Opacity.PRESSED} onPress={goToHistory}>
          <HistoryIcon
            color={Theme.colors.accentGreen}
            size={HISTORY_ICON_SIZE}
            strokeWidth={HISTORY_ICON_STROKE_WIDTH}
          />
        </TouchableOpacity>
      </View>
    </>
  )

  const renderSegmentedControl = () =>
    isSegmentedControlVisible && (
      <View style={styles.segmentRow}>
        <SegmentedControl<MacrosSegment>
          options={MACROS_SEGMENTS}
          selected={macrosSegment}
          onChange={setMacrosSegment}
          variant="large"
        />
      </View>
    )

  const renderDay = (day: DailyMacros) => {
    const targets = resolveAuthoritativeMacroTargets(targetAuthority, day.targets, fallbackTargetCalories)

    listSwipeItemManager.setRows(day.meals)

    return (
      <>
        <View style={styles.summaryCardContainer}>
          <DailySummaryCard totals={day.totals} targets={targets} />
        </View>

        {isLogWithAiEnabled() && (
          <View style={styles.aiCardContainer}>
            <LogWithAICard onPress={goToLogWithAI} />
          </View>
        )}

        {day.meals.map(meal => (
          <View key={meal.id} style={styles.mealCardContainer}>
            <MealCard
              meal={meal}
              onAddFoodPressed={() => goToAddFood(meal)}
              onEntryPressed={entry => goToEntryDetail(meal, entry)}
              onDeleteEntryPressed={onDeleteEntryPressed}
              swipeableRef={(ref, index) => listSwipeItemManager.setRef(ref, meal, index)}
              onSwipeActivated={index => listSwipeItemManager.closeRow(meal, index)}
            />
          </View>
        ))}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {!isDiaryLoading && (
        <Animated.View style={styles.root} entering={FadeIn.duration(CROSS_DISSOLVE_DURATION_MS)}>
          {/* The key is the segment isolation: without it both bodies share one native scroll view and
              the incoming segment opens at the outgoing segment's offset, below its own header. Distinct
              keys remount the container per segment, which is what resets the offset to the top. */}
          <ScrollView
            key={resolveMacrosBodyKey(isDiarySegment)}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {isDiarySegment ? (
              <>
                {renderHeader()}

                {renderSegmentedControl()}

                {!dailyMacros && isError && (
                  <TouchableOpacity
                    style={styles.retryContainer}
                    activeOpacity={Opacity.PRESSED}
                    onPress={() => refetch()}>
                    <Text style={styles.retryText}>{TOAST_GENERIC_ERROR}</Text>
                  </TouchableOpacity>
                )}

                {dailyMacros && renderDay(dailyMacros)}
              </>
            ) : (
              /* No header here on purpose: only the plan's own queries know whether its state wants the plan
                 header, the plain Macros one or neither yet, so choosing one here would render the wrong
                 header first and visibly swap it once the plan arrived. */
              <MealPlanTab segmentedControl={renderSegmentedControl()} />
            )}
          </ScrollView>
        </Animated.View>
      )}

      {isDiaryLoading && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.skeletonOverlay]}
          pointerEvents="none"
          exiting={FadeOut.duration(CROSS_DISSOLVE_DURATION_MS)}>
          <MacrosSkeleton dateLabel={eyebrowDate} />
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

export default MacrosScreen
