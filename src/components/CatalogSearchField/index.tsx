import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {CATALOG_SEARCH_MAX_QUERY_LENGTH} from '@utility/CatalogSearchStateUtility'

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

// Read from the shared catalog rule rather than restated here: the field must not be able to hold a query
// the search endpoint refuses, and one declaration of that bound is what keeps the two from drifting.
const CATALOG_QUERY_MAX_LENGTH = CATALOG_SEARCH_MAX_QUERY_LENGTH

interface SharedProps {
  value: string
  placeholder: string
  accessibilityLabel: string
}

// The two modes are separate contracts, so they are separate members of a discriminated union
// rather than one shape with optional callbacks: a `tapTarget` without `onPress` would be a dead
// control, and an `input` without `onClear`/`onCancel` would trap the user in the search field.
// The `never` members make the contradictory prop a compile error rather than a silently ignored one.
interface TapTargetProps extends SharedProps {
  mode: 'tapTarget'
  onPress: () => void
  onChangeText?: never
  onClear?: never
  onCancel?: never
  autoFocus?: never
  maxLength?: never
}

interface InputProps extends SharedProps {
  mode: 'input'
  onChangeText: (text: string) => void
  onClear: () => void
  onCancel: () => void
  autoFocus?: boolean
  maxLength?: number
  onPress?: never
}

type Props = TapTargetProps | InputProps

const CatalogSearchField = (props: Props): React.JSX.Element => {
  const {value, placeholder, accessibilityLabel} = props
  const hasValue = value.length > 0

  return (
    <View style={styles.container}>
      {props.mode === 'input' ? (
        <View style={[styles.field, styles.fieldFocused]}>
          <SearchMagnifierIcon color={Theme.colors.accentGreen} />

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={props.onChangeText}
            placeholder={placeholder}
            autoFocus={props.autoFocus ?? false}
            maxLength={props.maxLength ?? CATALOG_QUERY_MAX_LENGTH}
            accessibilityRole="search"
            accessibilityLabel={accessibilityLabel}
          />

          {hasValue && (
            <TouchableOpacity
              style={styles.clearButton}
              activeOpacity={Opacity.PRESSED}
              hitSlop={ACTION_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={MEAL_PLAN_CLEAR_SEARCH_ACCESSIBILITY_LABEL}
              onPress={props.onClear}>
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
          onPress={props.onPress}>
          <SearchMagnifierIcon color={Theme.colors.textMuted} />

          <Text style={[styles.valueLabel, !hasValue && styles.placeholderLabel]}>
            {hasValue ? value : placeholder}
          </Text>

          <ChevronRightIcon color={Theme.colors.textFaint} size={Sizes.ICON_MD} />
        </TouchableOpacity>
      )}

      {props.mode === 'input' && (
        <TouchableOpacity
          activeOpacity={Opacity.PRESSED}
          hitSlop={ACTION_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={MEAL_PLAN_CANCEL_SEARCH_ACCESSIBILITY_LABEL}
          onPress={props.onCancel}>
          <Text style={styles.cancelLabel}>{CANCEL_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default CatalogSearchField
