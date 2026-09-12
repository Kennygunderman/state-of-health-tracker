import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import BadgePill from '@components/BadgePill'
import Text from '@components/Text'

import {CAL_LABEL} from '@constants/strings'

import styles from './index.styled'
import {FoodListRowBadge, resolveBadgeVariant} from './index.util'

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

const FoodListRow = ({name, detail, subtitle, calories, onPress, badge}: Props) => {
  const badgeVariant = resolveBadgeVariant(badge)

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.textColumn}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.nameLine}>
            <Text style={styles.name}>{name}</Text>

            {!!detail && <Text style={styles.detail}>{` · ${detail}`}</Text>}
          </Text>

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
