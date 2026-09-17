import React from 'react'

import {StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native'

import {AntDesign} from '@expo/vector-icons'
import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import Text from '@components/Text'

import styles from './index.styled'
import {isDarkVariant, showsPlusIcon} from './index.util'

export type {SecondaryButtonVariant} from './index.util'

interface BaseProps {
  disabled?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

interface DefaultVariantProps extends BaseProps {
  label?: string
  variant?: 'default'
}

// The dark variant suppresses the plus glyph, so its label is the whole of its content and
// the only thing that can name it: required here rather than checked at runtime.
interface DarkVariantProps extends BaseProps {
  label: string
  variant: 'dark'
}

type Props = DefaultVariantProps | DarkVariantProps

const SecondaryButton = (props: Props): React.JSX.Element => {
  const {label, onPress, style, variant = 'default', disabled = false} = props
  const isDark = isDarkVariant(variant)

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={Opacity.PRESSED_CTA}>
      <View style={[styles.inner, isDark && styles.innerDark, disabled && styles.innerDisabled, style]}>
        {showsPlusIcon(variant) && <AntDesign name="plus" size={16} color={Theme.colors.accentGreen} />}

        {label && <Text style={[styles.label, isDark && styles.labelDark]}>{label}</Text>}
      </View>
    </TouchableOpacity>
  )
}

export default SecondaryButton
