import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {MIN_SERVINGS} from '@utility/ServingsUtility'

import TextInput from '@components/TextInput'

import {
  MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SERVINGS_FIELD_ACCESSIBILITY_LABEL
} from '@constants/strings'

import styles from './index.styled'
import {
  beginServingsDraft,
  isServingsDraftStale,
  MAX_PLANNED_SERVINGS,
  nextServingsDraft,
  ServingsFieldDraft,
  servingsFieldText
} from '../../index.util'

interface Props {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  onChangeText: (text: string) => void
}

const ServingsStepper = ({value, onDecrement, onIncrement, onChangeText}: Props): React.JSX.Element => {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<ServingsFieldDraft | null>(null)

  const isAtMin = value <= MIN_SERVINGS
  const isAtMax = value >= MAX_PLANNED_SERVINGS

  // The draft keeps raw keystrokes ('', '0.') that the confirmed value cannot represent, so reformatting on every
  // change would overwrite what is being typed. It is rebased as soon as the value moves for a reason this field did
  // not originate — a stepper press, a fraction chip, a parent reset or a refetch — which is the documented way to
  // adjust state when a prop changes; servingsFieldText already resolves to the new value in this same render pass.
  if (isServingsDraftStale(draft, value)) {
    setDraft(null)
  }

  const displayValue = servingsFieldText(value, draft)

  const onFieldFocus = () => {
    setFocused(true)
    setDraft(beginServingsDraft(value))
  }

  const onFieldBlur = () => {
    setFocused(false)
    setDraft(null)
  }

  const onFieldChangeText = (text: string) => {
    setDraft(nextServingsDraft(text, value))
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
