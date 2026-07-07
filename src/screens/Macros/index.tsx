import React, {useEffect} from 'react'

import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native'

import {DailyMacros} from '@data/models/DailyMacros'
import {Meal} from '@data/models/Meal'
import {MealEntry} from '@data/models/MealEntry'
import {Navigation} from '@navigation/types'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'
import {useDailyMacrosQuery} from '@queries/macros/useDailyMacrosQuery'
import {useDeleteMealEntryMutation} from '@queries/macros/useDeleteMealEntryMutation'
import {useNavigation} from '@react-navigation/native'
import {isCoachEnabled, isLogWithAiEnabled} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'
import useUserDataStore from '@store/userData/useUserData'
import {Theme} from '@styles/theme'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import ListSwipeItemManager from '@utility/ListSwipeItemManager'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {SafeAreaView} from 'react-native-safe-area-context'

import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import HistoryIcon from '@components/icons/HistoryIcon'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {MACROS_TITLE, TOAST_GENERIC_ERROR} from '@constants/strings'

import CoachCard from './components/CoachCard'
import DailySummaryCard from './components/DailySummaryCard'
import LogWithAICard from './components/LogWithAICard'
import MacrosSkeleton from './components/MacrosSkeleton'
import MealCard from './components/MealCard'
import WeeklyCheckInSheet from './components/WeeklyCheckInSheet'
import styles from './index.styled'
import {resolveMacroTargets} from './index.util'

const listSwipeItemManager = new ListSwipeItemManager()

// Module-level so a re-mounted Macros screen doesn't re-show a check-in the
// user already saw this app session (ack failures land here too)
const shownCheckInPlanIds = new Set<string>()

const HISTORY_ICON_SIZE = 22
const HISTORY_ICON_STROKE_WIDTH = 2
const CROSS_DISSOLVE_DURATION_MS = 250

const MacrosScreen = () => {
  const navigation = useNavigation<Navigation>()

  const dateIso = useSessionStore(state => state.sessionStartDateIso)
  const fallbackTargetCalories = useUserDataStore(state => state.targetCalories)

  const {data: dailyMacros, isLoading, isError, refetch} = useDailyMacrosQuery(dateIso)
  const {mutateAsync: deleteMealEntry} = useDeleteMealEntryMutation(dateIso)
  const {data: coachState} = useCoachStateQuery()

  const eyebrowDate = formatIsoDayMonthDay(dateIso)

  const pendingCheckIn = coachState?.mode === 'coached' ? coachState.pendingCheckIn : null

  useEffect(() => {
    if (!pendingCheckIn || shownCheckInPlanIds.has(pendingCheckIn.id)) return

    shownCheckInPlanIds.add(pendingCheckIn.id)
    openGlobalBottomSheet(<WeeklyCheckInSheet plan={pendingCheckIn} />)
  }, [pendingCheckIn])

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
      <TouchableOpacity style={styles.dateOverlineTouchable} activeOpacity={0.6} onPress={goToHistory}>
        <Text style={styles.dateOverline}>{eyebrowDate}</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>{MACROS_TITLE}</Text>

        <TouchableOpacity style={styles.historyButton} activeOpacity={0.6} onPress={goToHistory}>
          <HistoryIcon
            color={Theme.colors.accentGreen}
            size={HISTORY_ICON_SIZE}
            strokeWidth={HISTORY_ICON_STROKE_WIDTH}
          />
        </TouchableOpacity>
      </View>
    </>
  )

  const renderDay = (day: DailyMacros) => {
    const targets = resolveMacroTargets(day.targets, fallbackTargetCalories)

    listSwipeItemManager.setRows(day.meals)

    return (
      <>
        {renderHeader()}

        <View style={styles.summaryCardContainer}>
          <DailySummaryCard totals={day.totals} targets={targets} />
        </View>

        {isLogWithAiEnabled() && (
          <View style={styles.aiCardContainer}>
            <LogWithAICard onPress={goToLogWithAI} />
          </View>
        )}

        {isCoachEnabled() && (
          <View style={styles.aiCardContainer}>
            <CoachCard
              onSetUpPressed={() => navigation.push(Screens.COACH_INTRO)}
              onManagePressed={() => navigation.push(Screens.COACH_SETTINGS)}
            />
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
      {!isLoading && (
        <Animated.View style={styles.root} entering={FadeIn.duration(CROSS_DISSOLVE_DURATION_MS)}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {!dailyMacros && isError && (
              <>
                {renderHeader()}

                <TouchableOpacity style={styles.retryContainer} activeOpacity={0.6} onPress={() => refetch()}>
                  <Text style={styles.retryText}>{TOAST_GENERIC_ERROR}</Text>
                </TouchableOpacity>
              </>
            )}

            {dailyMacros && renderDay(dailyMacros)}
          </ScrollView>
        </Animated.View>
      )}

      {isLoading && (
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
