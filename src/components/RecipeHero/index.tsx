import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'
import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import {heroStrokeFor, iconComponentFor} from '@components/MealIconTile'
import Text from '@components/Text'

import {MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} from '@constants/strings'

import styles, {backButtonPosition} from './index.styled'

interface BaseProps {
  iconKey: RecipeIconKey
  contextText: string
  onBack: () => void
  size?: 'detail' | 'preview'
}

// A hero that only presents the recipe (12): its content carries no press target, so there is nothing to name.
interface StaticHeroProps extends BaseProps {
  onPress?: never
  accessibilityLabel?: never
}

// A hero whose content opens the recipe (13b → 12). The two modes are separate contracts rather than one
// shape with an optional callback: a pressable hero that nothing names is an unreachable control for a
// screen reader, and only the caller knows which recipe the press reaches, so the label is required here
// instead of defaulted. The `never` members make the contradictory prop a compile error.
interface PressableHeroProps extends BaseProps {
  onPress: () => void
  accessibilityLabel: string
}

type Props = StaticHeroProps | PressableHeroProps

const RecipeHero = (props: Props): React.JSX.Element => {
  const {iconKey, contextText, onBack, size = 'detail'} = props
  const insets = useSafeAreaInsets()
  const Glyph = iconComponentFor(iconKey)
  const glyphSize = size === 'preview' ? Sizes.HERO_TILE_SM : Sizes.HERO_TILE
  const glyphStroke = heroStrokeFor(iconKey)

  const content = (
    <>
      <View style={styles.glyph} importantForAccessibility="no">
        <Glyph color={Theme.colors.accentGreen} size={glyphSize} strokeWidth={glyphStroke} />
      </View>

      <View style={styles.contextPill}>
        <Text style={styles.contextPillLabel}>{contextText}</Text>
      </View>
    </>
  )

  // The back button is the pressable's sibling, never its child: as a descendant it would be an accessible
  // control inside another accessible control, which leaves a screen reader one button where there are two.
  // Drawn after the content layer, it still sits above it, so its own touches and hit slop keep winning.
  return (
    <View style={styles.band}>
      {props.onPress ? (
        <TouchableOpacity
          style={styles.content}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={props.accessibilityLabel}
          onPress={props.onPress}>
          {content}
        </TouchableOpacity>
      ) : (
        <View style={styles.content}>{content}</View>
      )}

      <View style={[styles.backSlot, backButtonPosition(insets.top)]}>
        <BackCircleButton variant="scrim" onPress={onBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />
      </View>
    </View>
  )
}

export default RecipeHero
