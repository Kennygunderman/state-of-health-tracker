import React, {useState} from 'react'

import {View} from 'react-native'

import Text from '@components/Text'
import TextInput from '@components/TextInput'

import styles from './index.styled'

interface Props {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  unit?: string
  state?: 'default' | 'error' | 'disabled'
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'
  maxLength?: number
  accessibilityLabel: string
}

const TextField = (props: Props): React.JSX.Element => {
  const {
    value,
    onChangeText,
    placeholder,
    unit,
    state = 'default',
    keyboardType = 'default',
    maxLength,
    accessibilityLabel
  } = props

  const [isFocused, setIsFocused] = useState(false)

  const isDisabled = state === 'disabled'
  const isError = state === 'error'
  const showFocusRing = isFocused && state === 'default'

  return (
    <View style={[styles.container, showFocusRing && styles.containerFocused, isError && styles.containerError]}>
      <TextInput
        style={[styles.input, value.length === 0 && styles.inputPlaceholder, isDisabled && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={!isDisabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{disabled: isDisabled}}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {/* Drawn, never announced: the unit is already inside the input's own accessible name ("Carbs, grams"),
          so as an element of its own this suffix is a reading stop that says "g" and means nothing. Both
          properties are needed — `accessibilityElementsHidden` is iOS, `importantForAccessibility` Android. */}
      {!!unit && (
        <Text style={styles.unit} accessibilityElementsHidden importantForAccessibility="no">
          {unit}
        </Text>
      )}
    </View>
  )
}

export default TextField
