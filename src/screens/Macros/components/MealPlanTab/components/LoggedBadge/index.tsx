import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import {MEAL_PLAN_LOGGED_BADGE_TEXT} from '@constants/strings'

import styles from './index.styled'

// A visual glyph only: the badge sits inside its one consumer's (`MealPlanCard`) open-recipe pressable, whose
// explicit label already carries the logged suffix that is this badge's text equivalent. Hiding it from
// assistive technology makes that deterministic on both platforms instead of relying on an explicit label
// happening to override its descendants, and keeps the card from announcing "logged" twice.
const LoggedBadge = (): React.JSX.Element => {
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.label}>{MEAL_PLAN_LOGGED_BADGE_TEXT}</Text>
    </View>
  )
}

export default LoggedBadge
