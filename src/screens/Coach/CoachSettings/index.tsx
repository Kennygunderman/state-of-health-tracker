import React, {useEffect, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {CoachGoal} from '@data/models/CoachState'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'
import {useDeleteCoachMutation} from '@queries/coach/useDeleteCoachMutation'
import {useUpdateCoachSettingsMutation} from '@queries/coach/useUpdateCoachSettingsMutation'
import {useNavigation} from '@react-navigation/native'

import ConfirmModal from '@components/dialog/ConfirmModal'
import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import {
  COACH_SETTINGS_PAUSE,
  COACH_SETTINGS_PAUSED_BODY,
  COACH_SETTINGS_RESUME,
  COACH_SETTINGS_SAVE,
  COACH_SETTINGS_SAVED_TOAST,
  COACH_SETTINGS_TITLE,
  COACH_SETTINGS_TURN_OFF,
  COACH_TURN_OFF_MODAL_BODY,
  COACH_TURN_OFF_MODAL_TITLE,
  COACH_TURNED_OFF_TOAST,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import {DEFAULT_RATE} from '../coachRates'
import styles from './index.styled'
import GoalRateSelector from '../components/GoalRateSelector'

const CoachSettingsScreen = () => {
  const navigation = useNavigation()
  const {data: coachState} = useCoachStateQuery()
  const {mutateAsync: updateSettingsAsync, isPending: isSaving} = useUpdateCoachSettingsMutation()
  const {mutateAsync: deleteCoachAsync} = useDeleteCoachMutation()

  const [goal, setGoal] = useState<CoachGoal>('lose')
  const [ratePctBw, setRatePctBw] = useState(DEFAULT_RATE.lose)
  const [isTurnOffModalVisible, setIsTurnOffModalVisible] = useState(false)

  // Server state is the source of truth; local state only tracks unsaved edits
  useEffect(() => {
    if (coachState?.goal) {
      setGoal(coachState.goal)
      setRatePctBw(coachState.ratePctBw ?? DEFAULT_RATE[coachState.goal])
    }
  }, [coachState?.goal, coachState?.ratePctBw])

  const isPaused = coachState?.mode === 'paused'
  const hasChanges = coachState != null && (goal !== coachState.goal || ratePctBw !== coachState.ratePctBw)

  const onGoalChange = (nextGoal: CoachGoal, nextRate: number) => {
    setGoal(nextGoal)
    setRatePctBw(nextRate)
  }

  const onSavePressed = async () => {
    try {
      await updateSettingsAsync({goal, ratePctBw})
      showToast('success', COACH_SETTINGS_SAVED_TOAST)
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  const onPauseTogglePressed = async () => {
    try {
      await updateSettingsAsync({mode: isPaused ? 'coached' : 'paused'})
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  const onTurnOffConfirmed = async () => {
    setIsTurnOffModalVisible(false)

    try {
      await deleteCoachAsync()
      showToast('success', COACH_TURNED_OFF_TOAST)
      navigation.goBack()
    } catch {
      showToast('error', TOAST_GENERIC_ERROR)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{COACH_SETTINGS_TITLE}</Text>

        {isPaused && <Text style={styles.pausedBody}>{COACH_SETTINGS_PAUSED_BODY}</Text>}

        <View style={styles.selectorWrapper}>
          <GoalRateSelector goal={goal} ratePctBw={ratePctBw} onGoalChange={onGoalChange} onRateChange={setRatePctBw} />
        </View>

        {hasChanges && (
          <View style={styles.saveWrapper}>
            <PrimaryButton label={COACH_SETTINGS_SAVE} isLoading={isSaving} onPress={onSavePressed} />
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.footerAction} activeOpacity={0.7} onPress={onPauseTogglePressed}>
        <Text style={styles.footerActionText}>{isPaused ? COACH_SETTINGS_RESUME : COACH_SETTINGS_PAUSE}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.footerAction} activeOpacity={0.7} onPress={() => setIsTurnOffModalVisible(true)}>
        <Text style={styles.turnOffText}>{COACH_SETTINGS_TURN_OFF}</Text>
      </TouchableOpacity>

      <ConfirmModal
        confirmationTitle={COACH_TURN_OFF_MODAL_TITLE}
        confirmationBody={COACH_TURN_OFF_MODAL_BODY}
        confirmButtonText={COACH_SETTINGS_TURN_OFF}
        isVisible={isTurnOffModalVisible}
        onConfirmPressed={onTurnOffConfirmed}
        onCancel={() => setIsTurnOffModalVisible(false)}
      />
    </View>
  )
}

export default CoachSettingsScreen
