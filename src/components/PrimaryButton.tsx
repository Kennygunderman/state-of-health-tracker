import React from 'react'

import {ActivityIndicator, StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native'

import {Text, useStyleTheme} from '@theme/Theme'

import BorderRadius from '@constants/BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

interface Props {
  label: string
  isLoading?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
  width?: string | number
}

const PrimaryButton = (props: Props) => {
  const {label, isLoading = false, onPress, style, width = '100%'} = props

  const theme = useStyleTheme()

  const handlePress = () => {
    if (!isLoading) {
      onPress()
    }
  }

  return (
    <TouchableOpacity
      style={{
        width,
        zIndex: -1
      }}
      onPress={handlePress}
      activeOpacity={0.5}>
      <View
        style={[
          {
            backgroundColor: useStyleTheme().colors.secondary,
            borderRadius: BorderRadius.BUTTON,
            borderColor: useStyleTheme().colors.secondaryLighter,
            padding: Spacing.SMALL,
            alignItems: 'center'
          },
          style
        ]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.secondaryLighter} />
        ) : (
          <Text
            style={{
              fontWeight: '500',
              fontSize: FontSize.H2,
              marginLeft: Spacing.XX_SMALL,
              marginRight: Spacing.XX_SMALL
            }}>
            {label}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default PrimaryButton
