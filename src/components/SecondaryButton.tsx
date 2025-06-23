import React from 'react'

import {StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native'

import BorderRadius from '@constants/BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import {AntDesign} from '@expo/vector-icons'
import {Text, useStyleTheme} from '@theme/Theme'

interface Props {
  label?: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

const SecondaryButton = (props: Props) => {
  const {label, onPress, style} = props

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.5}>
      <View
        style={[
          {
            borderRadius: BorderRadius.BUTTON,
            borderWidth: 1,
            borderColor: useStyleTheme().colors.border,
            padding: Spacing.X_SMALL,
            alignItems: 'center',
            flexDirection: 'row'
          },
          style
        ]}>
        <AntDesign name="plus" size={24} color={useStyleTheme().colors.white} />
        {label && (
          <Text
            style={{
              fontWeight: '500',
              fontSize: FontSize.H3,
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

export default SecondaryButton
