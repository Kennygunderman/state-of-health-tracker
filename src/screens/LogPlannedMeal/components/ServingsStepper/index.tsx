import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {formatServingsDisplay, MIN_SERVINGS} from '@utility/ServingsUtility'

import TextInput from '@components/TextInput'

import {
  MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SERVINGS_FIELD_ACCESSIBILITY_LABEL
} from '@constants/strings'

import styles from './index.styled'
import {MAX_PLANNED_SERVINGS} from '../../index.util'

interface Props {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  onChangeText: (text: string) => void
}

const ServingsStepper = ({value, onDecrement, onIncrement, onChangeText}: Props) => {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)

  const isAtMin = value <= MIN_SERVINGS
  const isAtMax = value >= MAX_PLANNED_SERVINGS

  // The draft holds the raw keystrokes while the field is focused; reformatting the confirmed value on
  // every change would overwrite what is being typed.
  const displayValue = draft ?? formatServingsDisplay(value)

  const onFieldFocus = () => {
    setFocused(true)
    setDraft(formatServingsDisplay(value))
  }

  const onFieldBlur = () => {
    setFocused(false)
    setDraft(null)
  }

  const onFieldChangeText = (text: string) => {
    setDraft(text)
    onChangeText(text)
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.stepButton, isAtMin && styles.stepButtonDisabled]}
        activeOpacity={Opacity.PRESSED}
        disabled={isAtMin}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL}
        accessibilityState={{disabled: isAtMin}}
        onPress={onDecrement}>
        <View style={styles.bar} />
      </TouchableOpacity>

      <TextInput
        style={[styles.field, focused && styles.fieldFocused]}
        value={displayValue}
        keyboardType="decimal-pad"
        accessibilityLabel={MEAL_PLAN_SERVINGS_FIELD_ACCESSIBILITY_LABEL}
        accessibilityValue={{text: displayValue}}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
        onChangeText={onFieldChangeText}
      />

      <TouchableOpacity
        style={[styles.stepButton, isAtMax && styles.stepButtonDisabled]}
        activeOpacity={Opacity.PRESSED}
        disabled={isAtMax}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL}
        accessibilityState={{disabled: isAtMax}}
        onPress={onIncrement}>
        <View style={styles.bar} />

        <View style={styles.barCrossing} />
      </TouchableOpacity>
    </View>
  )
}

export default ServingsStepper
