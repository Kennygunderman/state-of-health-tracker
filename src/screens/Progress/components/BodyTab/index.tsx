import React, {useRef, useState} from 'react'

import {Alert, TouchableOpacity, View} from 'react-native'

import {WeighIn} from '@data/models/WeighIn'
import {useWeightUnitLabel} from '@hooks/userData/useWeightUnitLabel'
import {ProgressStackParamList} from '@navigation/ProgressStack'
import {useDeleteWeighInMutation} from '@queries/weighIns/useDeleteWeighInMutation'
import {useWeighInsQuery} from '@queries/weighIns/useWeighInsQuery'
import {useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'
import {isCoachEnabled} from '@service/remoteConfig/initRemoteConfig'
import useUserData from '@store/userData/useUserData'
import {Theme} from '@styles/theme'
import {formatDateToMonthDay, formatDateToMonthDayName, formatDateToMonthDayYear} from '@utility/DateUtility'
import ListSwipeItemManager from '@utility/ListSwipeItemManager'
import {TimeOfDay} from '@utility/TimeOfDayUtility'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'

import GoalWeightModal from '@components/dialog/GoalWeightModal'
import MiniLineChart, {LineChartPoint} from '@components/MiniLineChart'
import PrimaryButton from '@components/PrimaryButton'
import SwipeDeleteListItem from '@components/SwipeDeleteListItem'
import Text from '@components/Text'
import TickerText from '@components/TickerText'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  OKAY_BUTTON_TEXT,
  PROGRESS_BODY_CHANGE_INFO_BODY,
  PROGRESS_BODY_CHANGE_INFO_TITLE,
  PROGRESS_BODY_CHANGE_LABEL,
  PROGRESS_BODY_DELTA_TEXT,
  PROGRESS_BODY_EMPTY_STAT,
  PROGRESS_BODY_EMPTY_SUBTITLE,
  PROGRESS_BODY_EMPTY_TITLE,
  PROGRESS_BODY_GOAL_AXIS_TEXT,
  PROGRESS_BODY_GOAL_LABEL,
  PROGRESS_BODY_LOG_WEIGHT_BUTTON,
  PROGRESS_BODY_SET_GOAL_LABEL,
  PROGRESS_BODY_TO_GO_LABEL,
  PROGRESS_BODY_WEIGH_IN_META,
  PROGRESS_BODY_WEIGH_INS_HEADER,
  PROGRESS_BODY_WEIGHT_LABEL,
  stringWithParameters,
  TIME_OF_DAY_AFTERNOON,
  TIME_OF_DAY_EVENING,
  TIME_OF_DAY_MORNING,
  TOAST_WEIGH_IN_DELETE_FAILED
} from '@constants/strings'

import ExpenditureCard from '../ExpenditureCard'
import styles from './index.styled'
import {
  buildWeighInRows,
  buildWeightTrend,
  formatListWeight,
  formatSignedDelta,
  formatWeightValue,
  getTimeOfDay,
  getToGoLbs,
  getWeightDelta,
  isDeltaTowardGoal
} from './index.util'

const DELTA_FADE_DURATION_MS = 80
const CHART_HEIGHT = 150

const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: TIME_OF_DAY_MORNING,
  afternoon: TIME_OF_DAY_AFTERNOON,
  evening: TIME_OF_DAY_EVENING
}

const listSwipeItemManager = new ListSwipeItemManager()

const BodyTab = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProgressStackParamList>>()
  const {data: weighIns = [], isLoading} = useWeighInsQuery()
  const goalWeight = useUserData(state => state.goalWeight)
  const weightUnitLabel = useWeightUnitLabel()
  const {mutateAsync: deleteWeighInAsync} = useDeleteWeighInMutation()

  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false)
  const [scrubbedPoint, setScrubbedPoint] = useState<LineChartPoint | null>(null)
  const [tickDirection, setTickDirection] = useState<1 | -1>(1)
  const previousIndexRef = useRef(0)

  const trend = buildWeightTrend(weighIns)
  const delta = getWeightDelta(trend)
  const rows = buildWeighInRows(weighIns)

  listSwipeItemManager.setRows(weighIns)

  const onLogWeightPressed = () => {
    navigation.navigate(Screens.LOG_WEIGHT)
  }

  const onDeleteWeighIn = async (weighIn: WeighIn) => {
    try {
      await deleteWeighInAsync(weighIn.id)
    } catch {
      showToast('error', TOAST_WEIGH_IN_DELETE_FAILED)
    }
  }

  // Avoid flashing the empty state + Log Weight button while the query resolves
  if (isLoading) {
    return null
  }

  if (weighIns.length === 0) {
    return (
      <View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{PROGRESS_BODY_EMPTY_TITLE}</Text>

          <Text style={styles.emptySubtitle}>{PROGRESS_BODY_EMPTY_SUBTITLE}</Text>
        </View>

        <PrimaryButton label={PROGRESS_BODY_LOG_WEIGHT_BUTTON} onPress={onLogWeightPressed} />
      </View>
    )
  }

  const first = trend[0]
  const last = trend[trend.length - 1]
  const displayedPoint = scrubbedPoint ?? last
  const toGoLbs = getToGoLbs(last.value, goalWeight)

  const onChangeInfoPressed = () => {
    Alert.alert(
      PROGRESS_BODY_CHANGE_INFO_TITLE,
      stringWithParameters(PROGRESS_BODY_CHANGE_INFO_BODY, formatDateToMonthDayYear(first.date)),
      [{text: OKAY_BUTTON_TEXT}]
    )
  }

  const onScrub = (index: number | null) => {
    const targetIndex = index ?? trend.length - 1

    setTickDirection(targetIndex >= Math.min(previousIndexRef.current, trend.length - 1) ? 1 : -1)
    previousIndexRef.current = targetIndex
    setScrubbedPoint(index === null ? null : (trend[index] ?? null))
  }

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>{PROGRESS_BODY_WEIGHT_LABEL}</Text>

          {scrubbedPoint ? (
            <TickerText
              text={formatDateToMonthDayName(scrubbedPoint.date)}
              direction={tickDirection}
              style={styles.scrubDate}
            />
          ) : (
            delta && (
              <Animated.View
                entering={FadeIn.duration(DELTA_FADE_DURATION_MS)}
                exiting={FadeOut.duration(DELTA_FADE_DURATION_MS)}>
                <Text style={[styles.delta, !isDeltaTowardGoal(delta.lbs, last.value, goalWeight) && styles.deltaAway]}>
                  {delta.lbs > 0 ? '▲ ' : '▼ '}

                  {stringWithParameters(
                    PROGRESS_BODY_DELTA_TEXT,
                    formatWeightValue(Math.abs(delta.lbs)),
                    weightUnitLabel,
                    delta.weeks.toString()
                  )}
                </Text>
              </Animated.View>
            )
          )}
        </View>

        <View style={styles.valueRow}>
          <TickerText text={formatWeightValue(displayedPoint.value)} direction={tickDirection} style={styles.value} />

          <Text style={styles.unit}>{weightUnitLabel}</Text>
        </View>

        <View style={styles.chartWrapper}>
          <MiniLineChart
            points={trend}
            height={CHART_HEIGHT}
            color={Theme.colors.teal}
            onScrub={onScrub}
            pointLabel={value => formatListWeight(value)}
            referenceValue={goalWeight ?? undefined}
          />
        </View>

        {trend.length > 1 && (
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>{formatDateToMonthDay(first.date)}</Text>

            {goalWeight !== null && (
              <Text style={styles.axisGoalLabel}>
                {stringWithParameters(PROGRESS_BODY_GOAL_AXIS_TEXT, formatWeightValue(goalWeight))}
              </Text>
            )}

            <Text style={styles.axisLabel}>{formatDateToMonthDay(last.date)}</Text>
          </View>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.footerCell} activeOpacity={0.7} onPress={onChangeInfoPressed}>
            <Text style={styles.label}>{PROGRESS_BODY_CHANGE_LABEL}</Text>

            <Text
              style={[
                styles.footerValue,
                delta && isDeltaTowardGoal(delta.lbs, last.value, goalWeight) && styles.footerValueAccent
              ]}>
              {delta ? formatSignedDelta(delta.lbs) : PROGRESS_BODY_EMPTY_STAT}

              {delta && <Text style={styles.footerUnit}>{` ${formatDateToMonthDay(first.date)}`}</Text>}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerCell, styles.footerCellDivided]}
            activeOpacity={0.7}
            onPress={() => setIsGoalModalVisible(true)}>
            <Text style={styles.label}>{PROGRESS_BODY_GOAL_LABEL}</Text>

            <Text style={styles.footerValue}>
              {goalWeight !== null ? formatWeightValue(goalWeight) : PROGRESS_BODY_EMPTY_STAT}

              <Text style={styles.footerUnit}>
                {goalWeight !== null ? ` ${weightUnitLabel}` : ` ${PROGRESS_BODY_SET_GOAL_LABEL}`}
              </Text>
            </Text>
          </TouchableOpacity>

          <View style={[styles.footerCell, styles.footerCellDivided]}>
            <Text style={styles.label}>{PROGRESS_BODY_TO_GO_LABEL}</Text>

            <Text style={styles.footerValue}>
              {toGoLbs !== null ? formatListWeight(toGoLbs) : PROGRESS_BODY_EMPTY_STAT}

              {toGoLbs !== null && <Text style={styles.footerUnit}>{` ${weightUnitLabel}`}</Text>}
            </Text>
          </View>
        </View>
      </View>

      {isCoachEnabled() && <ExpenditureCard />}

      <View style={styles.buttonWrapper}>
        <PrimaryButton label={PROGRESS_BODY_LOG_WEIGHT_BUTTON} onPress={onLogWeightPressed} />
      </View>

      <Text style={styles.sectionHeader}>{PROGRESS_BODY_WEIGH_INS_HEADER}</Text>

      {rows.map((row, index) => (
        <SwipeDeleteListItem
          key={row.weighIn.id}
          swipeableRef={ref => listSwipeItemManager.setRef(ref, row.weighIn, index)}
          onSwipeActivated={() => listSwipeItemManager.closeRow(row.weighIn, index)}
          onDeletePressed={() => onDeleteWeighIn(row.weighIn)}>
          <View style={styles.weighInRow}>
            <View>
              <Text style={styles.weighInWeight}>{`${formatListWeight(row.weighIn.weight)} ${weightUnitLabel}`}</Text>

              <Text style={styles.weighInMeta}>
                {stringWithParameters(
                  PROGRESS_BODY_WEIGH_IN_META,
                  formatDateToMonthDayName(row.weighIn.loggedAt),
                  TIME_OF_DAY_LABELS[getTimeOfDay(row.weighIn.loggedAt)]
                )}
              </Text>
            </View>

            {row.deltaFromPrevious !== null && (
              <Text style={[styles.weighInDelta, row.deltaFromPrevious > 0 && styles.weighInDeltaMuted]}>
                {formatSignedDelta(row.deltaFromPrevious)}
              </Text>
            )}
          </View>
        </SwipeDeleteListItem>
      ))}

      <GoalWeightModal isVisible={isGoalModalVisible} onDismissed={() => setIsGoalModalVisible(false)} />
    </View>
  )
}

export default BodyTab
