import React from 'react'

import {View} from 'react-native'

import {MaterialCommunityIcons} from '@expo/vector-icons'
import {Navigation} from '@navigation/types'
import {useNavigation} from '@react-navigation/native'
import {Theme} from '@styles/theme'

import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {
  COACH_INTRO_CTA,
  COACH_INTRO_POINT_1_BODY,
  COACH_INTRO_POINT_1_TITLE,
  COACH_INTRO_POINT_2_BODY,
  COACH_INTRO_POINT_2_TITLE,
  COACH_INTRO_POINT_3_BODY,
  COACH_INTRO_POINT_3_TITLE,
  COACH_INTRO_SUBTITLE,
  COACH_INTRO_TITLE
} from '@constants/strings'

import styles from './index.styled'

const ICON_SIZE = 26

const POINTS = [
  {icon: 'fire' as const, title: COACH_INTRO_POINT_1_TITLE, body: COACH_INTRO_POINT_1_BODY},
  {icon: 'calendar-refresh' as const, title: COACH_INTRO_POINT_2_TITLE, body: COACH_INTRO_POINT_2_BODY},
  {icon: 'heart-outline' as const, title: COACH_INTRO_POINT_3_TITLE, body: COACH_INTRO_POINT_3_BODY}
]

const CoachIntroScreen = () => {
  const navigation = useNavigation<Navigation>()

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{COACH_INTRO_TITLE}</Text>

        <Text style={styles.subtitle}>{COACH_INTRO_SUBTITLE}</Text>

        <View style={styles.points}>
          {POINTS.map(point => (
            <View key={point.title} style={styles.pointRow}>
              <MaterialCommunityIcons name={point.icon} size={ICON_SIZE} color={Theme.colors.accentGreen} />

              <View style={styles.pointTextWrapper}>
                <Text style={styles.pointTitle}>{point.title}</Text>

                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttonWrapper}>
        <PrimaryButton label={COACH_INTRO_CTA} onPress={() => navigation.push(Screens.COACH_SETUP)} />
      </View>
    </View>
  )
}

export default CoachIntroScreen
