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
  MAX_PLANNED_SERVINGS,
  nextServingsDraft,
  ServingsFieldDraft,
  servingsFieldText,
  shouldDiscardServingsDraft
} from '../../index.util'

interface Props {
  value: number
  onDecrement: () => void
  onIncrement: () => void
  onChangeText: (text: string) => void
  /**
   * The portion is on record and cannot be changed — an unresolved idempotency key is re-sent with the body it
   * was minted for (0.7.2). The row is then a reading of that body rather than a control: the value stays at
   * full strength for anyone reading it, and every way of changing it goes away, including for a screen reader.
   */
  disabled?: boolean
}

const ServingsStepper = ({
  value,
  onDecrement,
  onIncrement,
  onChangeText,
  disabled = false
}: Props): React.JSX.Element => {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<ServingsFieldDraft | null>(null)

  // Named for what the buttons do rather than for where the value sits: the ends of the range and a locked
  // portion withdraw the same affordance, and the accessible state below reports exactly this.
  const isDecrementDisabled = disabled || value <= MIN_SERVINGS
  const isIncrementDisabled = disabled || value >= MAX_PLANNED_SERVINGS

  // The draft keeps raw keystrokes ('', '0.') that the confirmed value cannot represent, so reformatting on every
  // change would overwrite what is being typed. It is rebased as soon as the value moves for a reason this field did
  // not originate — a stepper press, a fraction chip, a parent reset or a refetch — or as soon as the field locks,
  // which is the documented way to adjust state when a prop changes; servingsFieldText already resolves to the new
  // value in this same render pass.
  if (shouldDiscardServingsDraft(draft, value, disabled)) {
    setDraft(null)
  }

  const displayValue = servingsFieldText(value, disabled ? null : draft)
  const isFocusedAndEditable = focused && !disabled

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
        style={[styles.stepButton, isDecrementDisabled && styles.stepButtonDisabled]}
        activeOpacity={Opacity.PRESSED}
        disabled={isDecrementDisabled}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_DECREASE_SERVINGS_ACCESSIBILITY_LABEL}
        accessibilityState={{disabled: isDecrementDisabled}}
        onPress={onDecrement}>
        <View style={styles.bar} />
      </TouchableOpacity>

      {/* `editable` rather than only a blocked touch: a field left editable can still hold focus across the
          lock and accept keystrokes, which is how it came to display a portion the replay would not send. */}
      <TextInput
        style={[styles.field, isFocusedAndEditable && styles.fieldFocused, disabled && styles.fieldDisabled]}
        value={displayValue}
        keyboardType="decimal-pad"
        editable={!disabled}
        accessibilityLabel={MEAL_PLAN_SERVINGS_FIELD_ACCESSIBILITY_LABEL}
        accessibilityValue={{text: displayValue}}
        accessibilityState={{disabled}}
        onFocus={onFieldFocus}
        onBlur={onFieldBlur}
        onChangeText={onFieldChangeText}
      />

      <TouchableOpacity
        style={[styles.stepButton, isIncrementDisabled && styles.stepButtonDisabled]}
        activeOpacity={Opacity.PRESSED}
        disabled={isIncrementDisabled}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_INCREASE_SERVINGS_ACCESSIBILITY_LABEL}
        accessibilityState={{disabled: isIncrementDisabled}}
        onPress={onIncrement}>
        <View style={styles.bar} />

        <View style={styles.barCrossing} />
      </TouchableOpacity>
    </View>
  )
}

export default ServingsStepper
