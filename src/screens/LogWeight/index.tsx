import React, {useState} from 'react'

import {ScrollView, TouchableOpacity, View} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {useWeightUnitLabel} from '@hooks/userData/useWeightUnitLabel'
import {useLogWeighInMutation} from '@queries/weighIns/useLogWeighInMutation'
import {useNavigation} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'
import {Theme} from '@styles/theme'
import {getTimeOfDayForHour, TimeOfDay} from '@utility/TimeOfDayUtility'
import {addDays, subDays} from 'date-fns'

import PrimaryButton from '@components/PrimaryButton'
import SegmentedControl from '@components/SegmentedControl'
import Text from '@components/Text'
import TextInput from '@components/TextInput'
import {showToast} from '@components/toast/util/ShowToast'

import {
  LOG_WEIGHT_DATE_LABEL,
  LOG_WEIGHT_ERROR,
  LOG_WEIGHT_PLACEHOLDER,
  LOG_WEIGHT_SAVE_BUTTON,
  LOG_WEIGHT_TIME_LABEL,
  LOG_WEIGHT_TITLE,
  LOG_WEIGHT_WEIGHT_LABEL,
  stringWithParameters,
  TIME_OF_DAY_AFTERNOON_OPTION,
  TIME_OF_DAY_EVENING_OPTION,
  TIME_OF_DAY_MORNING_OPTION,
  TOAST_WEIGHT_LOG_FAILED
} from '@constants/strings'

import styles from './index.styled'
import {buildLoggedAtISO, canStepForward, formatLogDateLabel, parseWeightInput} from './index.util'

const MAX_WEIGHT_INPUT_LENGTH = 5

const TIME_OPTIONS = [
  {key: 'morning' as const, label: TIME_OF_DAY_MORNING_OPTION},
  {key: 'afternoon' as const, label: TIME_OF_DAY_AFTERNOON_OPTION},
  {key: 'evening' as const, label: TIME_OF_DAY_EVENING_OPTION}
]

const LogWeightScreen = () => {
  const {goBack} = useNavigation()
  const {mutateAsync: logWeighInAsync, isPending} = useLogWeighInMutation()
  const weightUnit = useUserData(state => state.weightUnit)
  const weightUnitLabel = useWeightUnitLabel()

  const [weightText, setWeightText] = useState('')
  const [date, setDate] = useState(new Date())
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDayForHour(new Date().getHours()))
  const [showError, setShowError] = useState(false)

  const isForwardEnabled = canStepForward(date, new Date())

  const onStepBack = () => setDate(current => subDays(current, 1))

  const onStepForward = () => setDate(current => addDays(current, 1))

  const onSavePressed = async () => {
    const weight = parseWeightInput(weightText)

    if (weight === null) {
      setShowError(true)

      return
    }

    setShowError(false)

    try {
      await logWeighInAsync({weight, loggedAt: buildLoggedAtISO(date, timeOfDay), unit: weightUnit})
      goBack()
    } catch {
      showToast('error', TOAST_WEIGHT_LOG_FAILED)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{LOG_WEIGHT_TITLE}</Text>

        <TouchableOpacity style={styles.closeButton} activeOpacity={0.7} onPress={goBack}>
          <Ionicons name="close" size={20} color={Theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>{stringWithParameters(LOG_WEIGHT_WEIGHT_LABEL, weightUnitLabel)}</Text>

        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={weightText}
            onChangeText={setWeightText}
            placeholder={LOG_WEIGHT_PLACEHOLDER}
            keyboardType="decimal-pad"
            maxLength={MAX_WEIGHT_INPUT_LENGTH}
            autoFocus
          />

          <Text style={styles.weightUnit}>{weightUnitLabel}</Text>
        </View>

        {showError && <Text style={styles.errorText}>{LOG_WEIGHT_ERROR}</Text>}

        <Text style={styles.fieldLabel}>{LOG_WEIGHT_DATE_LABEL}</Text>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateStepButton} activeOpacity={0.7} onPress={onStepBack}>
            <Ionicons name="chevron-back" size={20} color={Theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.dateLabel}>{formatLogDateLabel(date, new Date())}</Text>

          <TouchableOpacity
            style={[styles.dateStepButton, !isForwardEnabled && styles.dateStepButtonDisabled]}
            activeOpacity={0.7}
            disabled={!isForwardEnabled}
            onPress={onStepForward}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isForwardEnabled ? Theme.colors.text : Theme.colors.textDisabled}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>{LOG_WEIGHT_TIME_LABEL}</Text>

        <SegmentedControl options={TIME_OPTIONS} selected={timeOfDay} onChange={setTimeOfDay} />

        <View style={styles.buttonWrapper}>
          <PrimaryButton label={LOG_WEIGHT_SAVE_BUTTON} isLoading={isPending} onPress={onSavePressed} />
        </View>
      </ScrollView>
    </View>
  )
}

export default LogWeightScreen
