import React from 'react'

import {StyleProp, View, ViewStyle} from 'react-native'

import BorderRadius from '@constants/BorderRadius'
import Spacing from '@constants/Spacing'
import {Text, useStyleTheme} from '@theme/Theme'

interface Props {
  label: string
  icon?: JSX.Element
  style?: StyleProp<ViewStyle>
}

const Chip = (props: Props) => {
  const {label, icon, style} = props
  return (
    <View
      style={[
        {
          borderRadius: BorderRadius.CHIP,
          backgroundColor: useStyleTheme().colors.chip,
          padding: Spacing.XX_SMALL,
          paddingRight: Spacing.X_SMALL,
          flexDirection: 'row',
          alignItems: 'center'
        },
        style
      ]}>
      {icon && icon}
      <Text>{label}</Text>
    </View>
  )
}

export default Chip
