import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {SwapAlternative} from '@data/models/SwapAlternative'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import MealIconTile from '@components/MealIconTile'
import Text from '@components/Text'

import {
  SWAP_ALTERNATIVE_ACCESSIBILITY_TEMPLATE,
  SWAP_ALTERNATIVES_FOOTNOTE,
  stringWithNamedParameters
} from '@constants/strings'

import styles from './index.styled'

interface Props {
  alternative: SwapAlternative
  meta: string
  onPress: () => void
  isFirst: boolean
}

const AlternativeRow = ({alternative, meta, onPress, isFirst}: Props): React.JSX.Element => {
  const rowStyle = [styles.row, !isFirst && styles.rowDivided]

  const accessibilityLabel = stringWithNamedParameters(SWAP_ALTERNATIVE_ACCESSIBILITY_TEMPLATE, {
    name: alternative.name,
    meta
  })

  return (
    <TouchableOpacity
      style={rowStyle}
      activeOpacity={Opacity.PRESSED}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={SWAP_ALTERNATIVES_FOOTNOTE}
      onPress={onPress}>
      <MealIconTile iconKey={alternative.iconKey} size="md" />

      <View style={styles.textColumn}>
        <Text style={styles.name}>{alternative.name}</Text>

        <Text style={styles.meta}>{meta}</Text>
      </View>

      {/*
        The 8pt slot is what the row's flex layout advances by, so the text column keeps its reconciled
        width; the larger icon canvas overflows the slot horizontally exactly as the design's glyph
        overflows its own, and its drawn ink stays inside the 8pt box.
      */}
      <View style={styles.chevronSlot}>
        <ChevronRightIcon color={Theme.colors.textFaint} size={Sizes.ICON_MD} strokeWidth={Stroke.BOLD} />
      </View>
    </TouchableOpacity>
  )
}

export default AlternativeRow
