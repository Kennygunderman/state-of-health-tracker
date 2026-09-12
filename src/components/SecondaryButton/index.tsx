import React from 'react'

import {StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native'

import {AntDesign} from '@expo/vector-icons'
import {Theme} from '@styles/theme'

import Text from '@components/Text'

import styles from './index.styled'
import {isDarkVariant, SecondaryButtonVariant, showsPlusIcon} from './index.util'

export type {SecondaryButtonVariant} from './index.util'

interface Props {
  label?: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
  variant?: SecondaryButtonVariant
}

const SecondaryButton = (props: Props) => {
  const {label, onPress, style, variant = 'default'} = props
  const isDark = isDarkVariant(variant)

  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.5}>
      <View style={[styles.inner, isDark && styles.innerDark, style]}>
        {showsPlusIcon(variant) && <AntDesign name="plus" size={16} color={Theme.colors.accentGreen} />}

        {label && <Text style={[styles.label, isDark && styles.labelDark]}>{label}</Text>}
      </View>
    </TouchableOpacity>
  )
}

export default SecondaryButton
