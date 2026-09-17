import React, {useEffect, useState} from 'react'

import {Linking, TouchableOpacity, View} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {HomeTabsParamList} from '@navigation/HomeTabs'
import {Navigation} from '@navigation/types'
import {useRequestHealthPermissionsMutation} from '@queries/activity/useRequestHealthPermissionsMutation'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {isLegacyTargetEditorOpen, resolveTargetAuthority} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs'
import {CompositeNavigationProp, useNavigation} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useUserData from '@store/userData/useUserData'
import {Theme} from '@styles/theme'

import StepGoalModal from '@components/dialog/StepGoalModal'
import TargetCaloriesModal from '@components/dialog/TargetCaloriesModal'
import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'
import TickerText from '@components/TickerText'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  ACTIVITY_CALORIE_BURN_LABEL,
  ACTIVITY_CONNECT_HEALTH_BODY,
  ACTIVITY_CONNECT_HEALTH_BUTTON,
  ACTIVITY_CONNECT_HEALTH_TITLE,
  ACTIVITY_HEALTH_DENIED_BODY,
  ACTIVITY_HEALTH_DENIED_BUTTON,
  ACTIVITY_HEALTH_DENIED_TITLE,
  ACTIVITY_KCAL_UNIT,
  ACTIVITY_LEGEND_LIFTS,
  ACTIVITY_LEGEND_RUNS,
  ACTIVITY_LEGEND_STEPS,
  ACTIVITY_TARGET_INTAKE_LABEL,
  ACTIVITY_TARGET_STEPS_LABEL,
  ACTIVITY_TARGETS_LABEL,
  ACTIVITY_THIS_WEEK_HEADER,
  ACTIVITY_EMPTY_WEEK_TEXT,
  TOAST_HEALTH_CONNECT_FAILED
} from '@constants/strings'

import styles, {segmentFlex} from './index.styled'
import {buildWeekRows, CalorieSegmentKey, computeCalorieSegments} from './index.util'
import useActivitySummary from '../../hooks/useActivitySummary'
import {formatCount} from '../../index.util'
import BurnInfoBottomSheet from '../BurnInfoBottomSheet'
import StepsCard from '../StepsCard'

const SEGMENT_STYLES: Record<CalorieSegmentKey, object> = {
  lifts: styles.segmentLifts,
  steps: styles.segmentSteps,
  runs: styles.segmentRuns
}

const SEGMENT_LABELS: Record<CalorieSegmentKey, string> = {
  lifts: ACTIVITY_LEGEND_LIFTS,
  steps: ACTIVITY_LEGEND_STEPS,
  runs: ACTIVITY_LEGEND_RUNS
}

const INFO_ICON_SIZE = 14

const ActivityTab = () => {
  const navigation = useNavigation<CompositeNavigationProp<BottomTabNavigationProp<HomeTabsParamList>, Navigation>>()
  const stepGoal = useUserData(state => state.stepGoal)
  const targetCalories = useUserData(state => state.targetCalories)
  const isAuthed = useAuthStore(state => state.isAuthed)
  const targetsQuery = useNutritionTargetsQuery()
  const summary = useActivitySummary()
  const {mutateAsync: requestPermissionsAsync, isPending: isRequestingPermissions} =
    useRequestHealthPermissionsMutation()

  const [isStepGoalModalVisible, setIsStepGoalModalVisible] = useState(false)
  const [isIntakeModalVisible, setIsIntakeModalVisible] = useState(false)

  const segments = computeCalorieSegments(summary.today.liftKcal, summary.today.stepKcal, summary.today.runKcal)
  const weekRows = buildWeekRows(summary.previousDays, summary.isStepsAvailable)

  const showConnectCard = summary.isStepsAvailable && summary.shouldRequestPermission
  const showDeniedCard = summary.isStepsAvailable && !summary.shouldRequestPermission && !summary.hasStepData
  const showStepsCard = summary.isStepsAvailable && !summary.shouldRequestPermission && summary.hasStepData

  const targetAuthority = resolveTargetAuthority({read: targetsQuery, isAuthed})

  // Keeps the request from outliving the answer it was made under: while the modal is open the targets read can
  // resolve to server authority, and a request left standing would reopen the local-only writer the next time
  // the device owns the target.
  useEffect(() => {
    if (targetAuthority.editor !== 'legacy') {
      setIsIntakeModalVisible(false)
    }
  }, [targetAuthority.editor])

  const onConnectPressed = async () => {
    try {
      await requestPermissionsAsync()
    } catch {
      showToast('error', TOAST_HEALTH_CONNECT_FAILED)
    }
  }

  const onOpenSettingsPressed = () => {
    Linking.openSettings()
  }

  const onBurnInfoPressed = () => {
    openGlobalBottomSheet(<BurnInfoBottomSheet />)
  }

  const onIntakeTargetPressed = () => {
    if (targetAuthority.editor === 'canonical') {
      navigation.navigate('MacrosStack', {
        screen: Screens.MEAL_PLAN_EDIT_TARGETS,
        params: {mode: 'edit', returnTo: {kind: 'tab', tab: 'ProgressStack'}}
      })
    } else if (targetAuthority.editor === 'legacy') {
      setIsIntakeModalVisible(true)
    }
  }

  return (
    <View>
      {showConnectCard && (
        <View style={styles.card}>
          <Text style={styles.permissionTitle}>{ACTIVITY_CONNECT_HEALTH_TITLE}</Text>

          <Text style={styles.permissionBody}>{ACTIVITY_CONNECT_HEALTH_BODY}</Text>

          <PrimaryButton
            style={styles.permissionButton}
            label={ACTIVITY_CONNECT_HEALTH_BUTTON}
            isLoading={isRequestingPermissions}
            onPress={onConnectPressed}
          />
        </View>
      )}

      {showDeniedCard && (
        <View style={styles.card}>
          <Text style={styles.permissionTitle}>{ACTIVITY_HEALTH_DENIED_TITLE}</Text>

          <Text style={styles.permissionBody}>{ACTIVITY_HEALTH_DENIED_BODY}</Text>

          <PrimaryButton
            style={styles.permissionButton}
            label={ACTIVITY_HEALTH_DENIED_BUTTON}
            onPress={onOpenSettingsPressed}
          />
        </View>
      )}

      {showStepsCard && (
        <StepsCard weekSteps={summary.weekSteps} stepGoal={stepGoal} vsAveragePct={summary.vsAveragePct} />
      )}

      <View style={styles.card}>
        <TouchableOpacity style={styles.labelRow} activeOpacity={0.6} onPress={onBurnInfoPressed}>
          <Text style={styles.label}>{ACTIVITY_CALORIE_BURN_LABEL}</Text>

          <Ionicons name="information-circle-outline" size={INFO_ICON_SIZE} color={Theme.colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.valueRow}>
          <TickerText text={formatCount(summary.today.totalKcal)} direction={1} style={styles.value} />

          <Text style={styles.unit}>{ACTIVITY_KCAL_UNIT}</Text>
        </View>

        {segments.length > 0 && (
          <TouchableOpacity activeOpacity={0.6} onPress={onBurnInfoPressed}>
            <View style={styles.segmentBar}>
              {segments.map(segment => (
                <View
                  key={segment.key}
                  style={[styles.segment, SEGMENT_STYLES[segment.key], segmentFlex(segment.kcal)]}
                />
              ))}
            </View>

            <View style={styles.legendRow}>
              {segments.map(segment => (
                <View key={segment.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, SEGMENT_STYLES[segment.key]]} />

                  <Text style={styles.legendLabel}>
                    {`${SEGMENT_LABELS[segment.key]} `}

                    <Text style={styles.legendValue}>{formatCount(segment.kcal)}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.card, styles.targetsCard]}>
        <Text style={styles.label}>{ACTIVITY_TARGETS_LABEL}</Text>

        <View style={styles.targetsValues}>
          <TouchableOpacity activeOpacity={0.5} onPress={() => setIsStepGoalModalVisible(true)}>
            <Text style={styles.targetText}>
              {`${ACTIVITY_TARGET_STEPS_LABEL} `}

              <Text style={styles.targetValue}>{formatCount(stepGoal)}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.5} disabled={!targetAuthority.isEditable} onPress={onIntakeTargetPressed}>
            <Text style={styles.targetText}>
              {`${ACTIVITY_TARGET_INTAKE_LABEL} `}

              <Text style={styles.targetValue}>{formatCount(targetAuthority.serverCalories ?? targetCalories)}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionHeader}>{ACTIVITY_THIS_WEEK_HEADER}</Text>

      {weekRows.length === 0 ? (
        <Text style={styles.emptyWeekText}>{ACTIVITY_EMPTY_WEEK_TEXT}</Text>
      ) : (
        weekRows.map(row => (
          <View key={row.date} style={styles.weekRow}>
            <View>
              <Text style={styles.weekRowDay}>{row.dayLabel}</Text>

              <Text style={styles.weekRowMeta}>{row.metaText}</Text>
            </View>

            <View style={styles.weekRowRight}>
              <Text style={styles.weekRowKcal}>{row.kcalText}</Text>

              <Text style={styles.weekRowMeta}>{row.breakdownText}</Text>
            </View>
          </View>
        ))
      )}

      <StepGoalModal isVisible={isStepGoalModalVisible} onDismissed={() => setIsStepGoalModalVisible(false)} />

      <TargetCaloriesModal
        isVisible={isLegacyTargetEditorOpen(targetAuthority, isIntakeModalVisible)}
        onDismissed={() => setIsIntakeModalVisible(false)}
      />
    </View>
  )
}

export default ActivityTab
