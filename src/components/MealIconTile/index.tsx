import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import styles from './index.styled'
import {iconComponentFor, opticalTileStrokeFor, tileStrokeFor} from './index.util'

export {iconComponentFor, heroStrokeFor} from './index.util'

interface Props {
  iconKey: RecipeIconKey
  size?: 'md' | 'lg'
  strokeWidth?: number
  // 'card' is the weight the plan and swap tiles draw; 'optical' is the heavier mark frames 07 and 15
  // carry. The tile owns the translation because the number depends on each glyph's viewBox, so a
  // screen asks for the weight it wants by name instead of computing a stroke for someone else's
  // artwork. An explicit strokeWidth still wins, for a caller that has already done that arithmetic.
  glyphStroke?: 'card' | 'optical'
}

const MealIconTile = ({iconKey, size = 'lg', strokeWidth, glyphStroke = 'card'}: Props): React.JSX.Element => {
  const Icon = iconComponentFor(iconKey)
  const glyphSize = size === 'lg' ? Sizes.ICON_XL : Sizes.ICON
  const resolvedStroke =
    strokeWidth ?? (glyphStroke === 'optical' ? opticalTileStrokeFor(iconKey, glyphSize) : tileStrokeFor(iconKey))

  return (
    <View style={[styles.tile, size === 'lg' ? styles.tileLg : styles.tileMd]}>
      <Icon color={Theme.colors.accentGreen} size={glyphSize} strokeWidth={resolvedStroke} />
    </View>
  )
}

export default MealIconTile
