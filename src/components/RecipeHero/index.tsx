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

// A stacking index rather than a design value, which is why it is named here instead of in the `@styles`
// token maps: React Native paints and hit-tests siblings in tree order, so the back slot — rendered first
// below for reading order — needs one layer above the content layer to keep its pixels and its touches.
const BACK_SLOT_LAYER = 1

/**
 * The recipe hero band. Omitting `onPress` presents the recipe (12); passing it makes the content itself
 * the control that opens the recipe (13b → 12).
 *
 * `onPress` and `accessibilityLabel` belong to that second mode together: the band becomes an accessible
 * control only when a caller hands it `onPress`, and only the caller knows which recipe the press reaches,
 * so the caller is also the one that can name it. A single interface cannot make one optional member
 * require its sibling, so the render preserves what the pairing protects instead — an unnamed pressable
 * hero is an unreachable control for a screen reader, so a caller that supplies no label gets a button
 * named from `contextText`, the band's own visible context.
 */
interface Props {
  iconKey: RecipeIconKey
  contextText: string
  onBack: () => void
  size?: 'detail' | 'preview'
  onPress?: () => void
  accessibilityLabel?: string
}

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
  // It is drawn first so a reader reaches the escape before the hero's own action, and `BACK_SLOT_LAYER` is
  // what keeps it painted and hit-tested above the content layer it now precedes.
  return (
    <View style={styles.band}>
      <View style={[styles.backSlot, backButtonPosition(insets.top, BACK_SLOT_LAYER)]}>
        <BackCircleButton variant="scrim" onPress={onBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />
      </View>

      {props.onPress ? (
        <TouchableOpacity
          style={styles.content}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={props.accessibilityLabel ?? contextText}
          onPress={props.onPress}>
          {content}
        </TouchableOpacity>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </View>
  )
}

export default RecipeHero
