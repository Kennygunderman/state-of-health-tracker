import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import SearchMagnifierIcon from '@components/icons/SearchMagnifierIcon'
import Text from '@components/Text'
import TextInput from '@components/TextInput'

import {
  CANCEL_BUTTON_TEXT,
  MEAL_PLAN_CANCEL_SEARCH_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CLEAR_SEARCH_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SEARCH_CLEAR_GLYPH
} from '@constants/strings'

import styles from './index.styled'

const ACTION_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.ICON) / 2

const CATALOG_QUERY_MAX_LENGTH = 60

interface Props {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
  mode: 'tapTarget' | 'input'
  onPress?: () => void
  onClear?: () => void
  onCancel?: () => void
  autoFocus?: boolean
  maxLength?: number
  accessibilityLabel: string
}

const CatalogSearchField = ({
  value,
  onChangeText,
  placeholder,
  mode,
  onPress,
  onClear,
  onCancel,
  autoFocus = false,
  maxLength = CATALOG_QUERY_MAX_LENGTH,
  accessibilityLabel
}: Props) => {
  const isInput = mode === 'input'
  const hasValue = value.length > 0

  return (
    <View style={styles.container}>
      {isInput ? (
        <View style={[styles.field, styles.fieldFocused]}>
          <SearchMagnifierIcon color={Theme.colors.accentGreen} />

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            autoFocus={autoFocus}
            maxLength={maxLength}
            accessibilityRole="search"
            accessibilityLabel={accessibilityLabel}
          />

          {hasValue && onClear && (
            <TouchableOpacity
              style={styles.clearButton}
              activeOpacity={Opacity.PRESSED}
              hitSlop={ACTION_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={MEAL_PLAN_CLEAR_SEARCH_ACCESSIBILITY_LABEL}
              onPress={onClear}>
              <Text style={styles.clearGlyph}>{MEAL_PLAN_SEARCH_CLEAR_GLYPH}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.field}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}>
          <SearchMagnifierIcon color={Theme.colors.textMuted} />

          <Text style={[styles.valueLabel, !hasValue && styles.placeholderLabel]}>
            {hasValue ? value : placeholder}
          </Text>

          <ChevronRightIcon color={Theme.colors.textFaint} strokeWidth={Stroke.BOLD} />
        </TouchableOpacity>
      )}

      {isInput && onCancel && (
        <TouchableOpacity
          activeOpacity={Opacity.PRESSED}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={MEAL_PLAN_CANCEL_SEARCH_ACCESSIBILITY_LABEL}
          onPress={onCancel}>
          <Text style={styles.cancelLabel}>{CANCEL_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default CatalogSearchField
