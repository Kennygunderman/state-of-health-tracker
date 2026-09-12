import React from 'react'

import {View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import {heroStrokeFor, iconComponentFor} from '@components/MealIconTile'
import Text from '@components/Text'

import {MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} from '@constants/strings'

import styles, {backButtonPosition} from './index.styled'

interface Props {
  iconKey: RecipeIconKey
  contextText: string
  onBack: () => void
  size?: 'detail' | 'preview'
}

const RecipeHero = ({iconKey, contextText, onBack, size = 'detail'}: Props): React.JSX.Element => {
  const insets = useSafeAreaInsets()
  const Glyph = iconComponentFor(iconKey)
  const glyphSize = size === 'preview' ? Sizes.HERO_TILE_SM : Sizes.HERO_TILE
  const glyphStroke = heroStrokeFor(iconKey)

  return (
    <View style={styles.band}>
      <View style={styles.glyph} importantForAccessibility="no">
        <Glyph color={Theme.colors.accentGreen} size={glyphSize} strokeWidth={glyphStroke} />
      </View>

      <View style={[styles.backSlot, backButtonPosition(insets.top)]}>
        <BackCircleButton variant="scrim" onPress={onBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />
      </View>

      <View style={styles.contextPill}>
        <Text style={styles.contextPillLabel}>{contextText}</Text>
      </View>
    </View>
  )
}

export default RecipeHero
