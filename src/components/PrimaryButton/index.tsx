import React from 'react'

import {ActivityIndicator, DimensionValue, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import Text from '@components/Text'

import styles, {buttonTouchable} from './index.styled'
import {isDimmed, isPressBlocked, isStyleDimmed} from './index.util'

interface Props {
  label: string
  isLoading?: boolean
  disabled?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  width?: DimensionValue
}

const PrimaryButton = (props: Props): React.JSX.Element => {
  const {label, isLoading = false, disabled = false, onPress, style, width = '100%'} = props
  const pressBlocked = isPressBlocked(isLoading, disabled)
  const dimmed = isDimmed(isLoading, disabled)
  const announcedDisabled = pressBlocked || isStyleDimmed(StyleSheet.flatten(style)?.opacity, Opacity.DISABLED)
  const handlePress = () => {
    if (!pressBlocked) {
      onPress()
    }
  }

  return (
    <TouchableOpacity
      style={buttonTouchable(width)}
      onPress={handlePress}
      activeOpacity={Opacity.PRESSED_CTA}
      disabled={pressBlocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: announcedDisabled, busy: isLoading}}>
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
