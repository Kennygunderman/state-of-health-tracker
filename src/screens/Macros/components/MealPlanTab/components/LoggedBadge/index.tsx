import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import {MEAL_PLAN_LOGGED_BADGE_TEXT} from '@constants/strings'

import styles from './index.styled'

const LoggedBadge = () => {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{MEAL_PLAN_LOGGED_BADGE_TEXT}</Text>
    </View>
  )
}

export default LoggedBadge
