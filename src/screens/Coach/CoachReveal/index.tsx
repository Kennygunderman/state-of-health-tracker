import React from 'react'

import {View} from 'react-native'

import {Navigation, RootStackParamList} from '@navigation/types'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'
import {useEnrollCoachMutation} from '@queries/coach/useEnrollCoachMutation'
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native'

import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import {
  COACH_ENROLLED_TOAST,
  COACH_REVEAL_BODY,
  COACH_REVEAL_CTA,
  COACH_REVEAL_ERROR,
  COACH_REVEAL_EXPENDITURE_LABEL,
  COACH_REVEAL_TITLE,
  EXPENDITURE_CARD_UNIT
} from '@constants/strings'

import styles from './index.styled'

const CoachRevealScreen = () => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<RouteProp<RootStackParamList, 'Coach Reveal'>>()
  const {data: coachState} = useCoachStateQuery()
  const {mutateAsync: enrollAsync, isPending} = useEnrollCoachMutation()

  const onStartPressed = async () => {
    try {
      await enrollAsync({
        goal: params.goal,
        ratePctBw: params.ratePctBw,
        sex: params.sex,
        birthDate: params.birthDate,
        heightCm: params.heightCm
      })

      showToast('success', COACH_ENROLLED_TOAST)
      navigation.popToTop()
    } catch {
      showToast('error', COACH_REVEAL_ERROR)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{COACH_REVEAL_TITLE}</Text>

        {coachState?.tdeeKcal != null && (
          <View style={styles.estimateCard}>
            <Text style={styles.estimateLabel}>{COACH_REVEAL_EXPENDITURE_LABEL}</Text>

            <View style={styles.estimateRow}>
              <Text style={styles.estimateValue}>{coachState.tdeeKcal.toLocaleString('en-US')}</Text>

              <Text style={styles.estimateUnit}>{EXPENDITURE_CARD_UNIT}</Text>
            </View>
          </View>
        )}

        <Text style={styles.body}>{COACH_REVEAL_BODY}</Text>
      </View>

      <View style={styles.buttonWrapper}>
        <PrimaryButton label={COACH_REVEAL_CTA} isLoading={isPending} onPress={onStartPressed} />
      </View>
    </View>
  )
}

export default CoachRevealScreen
