import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {RecipeIconKey} from '@data/models/Recipe'
import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import BackCircleButton from '@components/BackCircleButton'
import {heroStrokeFor, iconComponentFor} from '@components/MealIconTile'
import Skeleton from '@components/Skeleton'
import Text from '@components/Text'

import {MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} from '@constants/strings'

import styles, {backButtonPosition, heroGlyphSize, RecipeHeroSize} from './index.styled'

export type {RecipeHeroSize} from './index.styled'

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
interface RecipeProps {
  variant?: 'recipe'
  iconKey: RecipeIconKey
  contextText: string
  onBack: () => void
  size?: RecipeHeroSize
  onPress?: () => void
  accessibilityLabel?: string
}

/**
 * The same band while there is no recipe to present yet. It exists because the band, not the screen, owns
 * the only back control on a route drawn with no header and no tab bar: a screen that swapped the whole band
 * for a placeholder left a read that can run for the request timeout with no on-screen way out.
 *
 * `width` is a prop rather than a `useWindowDimensions()` call because `Skeleton` sizes its shimmer sweep
 * from a number, and subscribing here would put a dimensions subscription on every hero the app renders.
 */
interface PendingProps {
  variant: 'pending'
  onBack: () => void
  width: number
}

type Props = RecipeProps | PendingProps

const RecipeHero = (props: Props): React.JSX.Element => {
  const insets = useSafeAreaInsets()

  // The back button is the pressable's sibling, never its child: as a descendant it would be an accessible
  // control inside another accessible control, which leaves a screen reader one button where there are two.
  // It is drawn first in both variants so a reader reaches the escape before the band's own content, and
  // `BACK_SLOT_LAYER` is what keeps it painted and hit-tested above the layer it now precedes.
  const backSlot = (
    <View style={[styles.backSlot, backButtonPosition(insets.top, BACK_SLOT_LAYER)]}>
      <BackCircleButton
        variant="scrim"
        onPress={props.onBack}
        accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL}
      />
    </View>
  )

  // No frame draws this state, so it is the band's own geometry with the app's `Skeleton` where the glyph and
  // the context pill would be (AAP 0.2.5). The placeholder is deliberately NOT hidden from assistive tech the
  // way a placeholder normally is: the back button inside it is the screen's only exit while the read is in
  // flight, so hiding the band's descendants would hide the one control this variant exists to keep.
  if (props.variant === 'pending') {
    return (
      <View style={styles.band}>
        {backSlot}

        <Skeleton height={Sizes.HERO_BAND_H} width={props.width} />
      </View>
    )
  }

  const {iconKey, contextText, size = 'detail'} = props
  const Glyph = iconComponentFor(iconKey)
  const glyphSize = heroGlyphSize(size)
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

  return (
    <View style={styles.band}>
      {backSlot}

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
