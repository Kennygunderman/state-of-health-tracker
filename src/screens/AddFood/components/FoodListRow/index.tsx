import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'

import BadgePill from '@components/BadgePill'
import Text from '@components/Text'

import {ADD_FOOD_ROW_ACCESSIBILITY_HINT, CAL_LABEL} from '@constants/strings'

import styles from './index.styled'
import {FoodListRowBadge, foodListRowAccessibilityLabel, resolveBadgeVariant} from './index.util'

interface Props {
  name: string
  // Muted text rendered inline after the name, e.g. '· 1 cup'
  detail?: string | null
  // Muted second line, e.g. '1g P · 50g C · 3g F' or a brand name
  subtitle?: string | null
  calories: number
  onPress: () => void
  // Catalog provenance pill rendered after the name, e.g. 'Source-backed'; absent means the row has no pill
  badge?: FoodListRowBadge
}

const FoodListRow = ({name, detail, subtitle, calories, onPress, badge}: Props): React.JSX.Element => {
  const badgeVariant = resolveBadgeVariant(badge)
  const accessibilityLabel = foodListRowAccessibilityLabel({name, detail, subtitle, calories, badge})

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={Opacity.PRESSED_SUBTLE}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={ADD_FOOD_ROW_ACCESSIBILITY_HINT}
      onPress={onPress}>
      <View style={styles.textColumn}>
        <View style={styles.nameRow}>
          {/* The name and the serving are siblings rather than children of one capped Text, because a single
              Text ellipsizes its whole string at the end — which made the serving, the row's only statement
              of what the calories are for, the first thing a long catalog name pushed out. Each is capped on
              its own and only the name may shrink, so the name is what truncates. */}
          <View style={styles.nameGroup}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>

            {!!detail && <Text numberOfLines={1} style={styles.detail}>{` · ${detail}`}</Text>}
          </View>

          {badge && badgeVariant !== 'none' && <BadgePill label={badge.label} tone={badgeVariant} />}
        </View>

        {!!subtitle && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      <Text style={styles.caloriesText}>
        <Text style={styles.caloriesValue}>{Math.round(calories)}</Text>

        <Text style={styles.caloriesLabel}>{` ${CAL_LABEL}`}</Text>
      </Text>
    </TouchableOpacity>
  )
}

export default FoodListRow
