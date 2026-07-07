import React, {useState} from 'react'

import {View} from 'react-native'

import {CoachGoal} from '@data/models/CoachState'
import {Navigation} from '@navigation/types'
import {useNavigation} from '@react-navigation/native'

import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {COACH_CONTINUE, COACH_SETUP_SUBTITLE, COACH_SETUP_TITLE} from '@constants/strings'

import {DEFAULT_RATE} from '../coachRates'
import styles from './index.styled'
import GoalRateSelector from '../components/GoalRateSelector'

const CoachSetupScreen = () => {
  const navigation = useNavigation<Navigation>()

  const [goal, setGoal] = useState<CoachGoal>('lose')
  const [ratePctBw, setRatePctBw] = useState(DEFAULT_RATE.lose)

  const onGoalChange = (nextGoal: CoachGoal, nextRate: number) => {
    setGoal(nextGoal)
    setRatePctBw(nextRate)
  }

  const onContinuePressed = () => {
    navigation.push(Screens.COACH_PROFILE, {goal, ratePctBw})
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{COACH_SETUP_TITLE}</Text>

        <Text style={styles.subtitle}>{COACH_SETUP_SUBTITLE}</Text>

        <View style={styles.selectorWrapper}>
          <GoalRateSelector goal={goal} ratePctBw={ratePctBw} onGoalChange={onGoalChange} onRateChange={setRatePctBw} />
        </View>
      </View>

      <View style={styles.buttonWrapper}>
        <PrimaryButton label={COACH_CONTINUE} onPress={onContinuePressed} />
      </View>
    </View>
  )
}

export default CoachSetupScreen
