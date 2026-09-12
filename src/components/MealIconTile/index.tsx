import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import {CLOCHE_CARD_STROKE} from '@components/icons/HeroClocheIcon'
import {POT_CARD_STROKE} from '@components/icons/HeroPotIcon'

import styles from './index.styled'
import {iconComponentFor} from './index.util'

export {iconComponentFor, heroStrokeFor} from './index.util'

interface Props {
  iconKey: RecipeIconKey
  size?: 'md' | 'lg'
  strokeWidth?: number
}

// Only pot and cloche need a tile stroke: their viewBoxes are 76 and 70 units and their own defaults
// are the hero strokes, while the flat glyphs' 24-unit default already renders the tile stroke.
const CARD_STROKE: Partial<Record<RecipeIconKey, number>> = {
  pot: POT_CARD_STROKE,
  cloche: CLOCHE_CARD_STROKE
}

const MealIconTile = ({iconKey, size = 'lg', strokeWidth}: Props): React.JSX.Element => {
  const Icon = iconComponentFor(iconKey)

  return (
    <View style={[styles.tile, size === 'lg' ? styles.tileLg : styles.tileMd]}>
      <Icon
        color={Theme.colors.accentGreen}
        size={size === 'lg' ? Sizes.ICON_XL : Sizes.ICON}
        strokeWidth={strokeWidth ?? CARD_STROKE[iconKey]}
      />
    </View>
  )
}

export default MealIconTile
