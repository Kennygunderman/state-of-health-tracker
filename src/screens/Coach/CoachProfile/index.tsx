import React, {useState} from 'react'

import {View} from 'react-native'

import {CoachSex} from '@data/models/CoachState'
import {Navigation, RootStackParamList} from '@navigation/types'
import {RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import useUserData from '@store/userData/useUserData'

import PrimaryButton from '@components/PrimaryButton'
import SegmentedControl from '@components/SegmentedControl'
import Text from '@components/Text'
import TextInput from '@components/TextInput'

import Screens from '@constants/screens'
import {
  COACH_CONTINUE,
  COACH_PROFILE_AGE_LABEL,
  COACH_PROFILE_HEIGHT_CM_PLACEHOLDER,
  COACH_PROFILE_HEIGHT_FT_PLACEHOLDER,
  COACH_PROFILE_HEIGHT_IN_PLACEHOLDER,
  COACH_PROFILE_HEIGHT_LABEL,
  COACH_PROFILE_SEX_LABEL,
  COACH_PROFILE_SUBTITLE,
  COACH_PROFILE_TITLE,
  COACH_SEX_FEMALE,
  COACH_SEX_MALE,
  COACH_SEX_UNSPECIFIED
} from '@constants/strings'

import styles from './index.styled'
import {birthDateFromAge, feetInchesToCm, parseCm} from './index.util'

type SexOption = CoachSex

const SEX_OPTIONS = [
  {key: 'male' as const, label: COACH_SEX_MALE},
  {key: 'female' as const, label: COACH_SEX_FEMALE},
  {key: 'unspecified' as const, label: COACH_SEX_UNSPECIFIED}
]

const CoachProfileScreen = () => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<RouteProp<RootStackParamList, 'Coach Profile'>>()
  const weightUnit = useUserData(state => state.weightUnit)

  const [sex, setSex] = useState<SexOption>('unspecified')
  const [ageText, setAgeText] = useState('')
  const [feetText, setFeetText] = useState('')
  const [inchesText, setInchesText] = useState('')
  const [cmText, setCmText] = useState('')

  const usesMetricHeight = weightUnit === 'kg'

  const onContinuePressed = () => {
    const heightCm = usesMetricHeight ? parseCm(cmText) : feetInchesToCm(feetText, inchesText)

    navigation.push(Screens.COACH_REVEAL, {
      goal: params.goal,
      ratePctBw: params.ratePctBw,
      sex: sex === 'unspecified' ? null : sex,
      birthDate: birthDateFromAge(ageText),
      heightCm
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{COACH_PROFILE_TITLE}</Text>

        <Text style={styles.subtitle}>{COACH_PROFILE_SUBTITLE}</Text>

        <Text style={styles.fieldLabel}>{COACH_PROFILE_SEX_LABEL}</Text>

        <SegmentedControl options={SEX_OPTIONS} selected={sex} onChange={setSex} />

        <Text style={styles.fieldLabel}>{COACH_PROFILE_AGE_LABEL}</Text>

        <TextInput value={ageText} onChangeText={setAgeText} keyboardType="number-pad" maxLength={3} />

        <Text style={styles.fieldLabel}>{COACH_PROFILE_HEIGHT_LABEL}</Text>

        {usesMetricHeight ? (
          <TextInput
            value={cmText}
            onChangeText={setCmText}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={COACH_PROFILE_HEIGHT_CM_PLACEHOLDER}
          />
        ) : (
          <View style={styles.heightRow}>
            <View style={styles.heightInput}>
              <TextInput
                value={feetText}
                onChangeText={setFeetText}
                keyboardType="number-pad"
                maxLength={1}
                placeholder={COACH_PROFILE_HEIGHT_FT_PLACEHOLDER}
              />
            </View>

            <View style={styles.heightInput}>
              <TextInput
                value={inchesText}
                onChangeText={setInchesText}
                keyboardType="number-pad"
                maxLength={2}
                placeholder={COACH_PROFILE_HEIGHT_IN_PLACEHOLDER}
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.buttonWrapper}>
        <PrimaryButton label={COACH_CONTINUE} onPress={onContinuePressed} />
      </View>
    </View>
  )
}

export default CoachProfileScreen
