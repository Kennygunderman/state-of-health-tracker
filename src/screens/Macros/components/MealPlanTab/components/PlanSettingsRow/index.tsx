import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import Text from '@components/Text'

import {MEAL_PLAN_SETTINGS_ACCESSIBILITY_LABEL, MEAL_PLAN_SETTINGS_ROW_LABEL} from '@constants/strings'

import styles from './index.styled'

interface Props {
  onPress: () => void
}

// No entry point to plan settings is drawn in the design; the plan header's one action is the grocery list.
const PlanSettingsRow = ({onPress}: Props) => (
  <TouchableOpacity
    style={styles.row}
    activeOpacity={Opacity.PRESSED}
    accessibilityRole="button"
    accessibilityLabel={MEAL_PLAN_SETTINGS_ACCESSIBILITY_LABEL}
    onPress={onPress}>
    <View style={styles.labelContainer}>
      <Text style={styles.label}>{MEAL_PLAN_SETTINGS_ROW_LABEL}</Text>
    </View>

    <ChevronRightIcon color={Theme.colors.textFaint} strokeWidth={Stroke.BOLD} />
  </TouchableOpacity>
)

export default PlanSettingsRow
