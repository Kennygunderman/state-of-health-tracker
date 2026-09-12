import React from 'react'

import {ActivityIndicator, DimensionValue, StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native'

import {Theme} from '@styles/theme'

import Text from '@components/Text'

import styles, {buttonTouchable} from './index.styled'
import {isDimmed, isPressBlocked} from './index.util'

interface Props {
  label: string
  isLoading?: boolean
  disabled?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  width?: DimensionValue
}

const PrimaryButton = (props: Props) => {
  const {label, isLoading = false, disabled = false, onPress, style, width = '100%'} = props
  const pressBlocked = isPressBlocked(isLoading, disabled)
  const dimmed = isDimmed(isLoading, disabled)
  const handlePress = () => {
    if (!pressBlocked) {
      onPress()
    }
  }

  return (
    <TouchableOpacity
      style={buttonTouchable(width)}
      onPress={handlePress}
      activeOpacity={0.5}
      disabled={pressBlocked}
      accessibilityRole="button"
      accessibilityState={{disabled: pressBlocked}}>
      <View style={[styles.inner, dimmed && styles.innerDisabled, style]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={Theme.colors.white} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default PrimaryButton
