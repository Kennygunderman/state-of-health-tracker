import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  label: string
  onPress: () => void
  isLoading?: boolean
  disabled?: boolean
}

const TertiaryTextButton = (props: Props): React.JSX.Element => {
  const {label, onPress, isLoading = false, disabled = false} = props
  const isInactive = isLoading || disabled

  const handlePress = () => {
    if (!isInactive) {
      onPress()
    }
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={Opacity.PRESSED_CTA}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled: isInactive}}>
      <View style={[styles.inner, isInactive && styles.innerDisabled]}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default TertiaryTextButton
