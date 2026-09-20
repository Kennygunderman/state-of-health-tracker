import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma places the hero back button 4px below the 50px status band it draws (y 54) — 4px higher than the
// plain back rows elsewhere in the flow. That band is never drawn here, so the live inset replaces it.
// `layer` is the slot's stacking index, which the caller owns because it is not a design value and so has
// no token to resolve against: it maps to nothing in Figma and only says that the slot, now the band's
// first child, still paints above the content layer it precedes.
export const backButtonPosition = (topInset: number, layer: number): ViewStyle => ({
  top: topInset + Spacing.XX_SMALL,
  zIndex: layer
})

export type RecipeHeroSize = 'detail' | 'preview'

// Two glyph sizes, one per frame that draws this band: 76 for the recipe hero (`49:534`) and 70 for the
// preview's cloche (`36:132`). It reads as a variant but is a size the renderer needs as a number, so it
// resolves here beside the band's other geometry rather than as a second style object to merge.
export const heroGlyphSize = (size: RecipeHeroSize): number =>
  size === 'preview' ? Sizes.HERO_TILE_SM : Sizes.HERO_TILE

export default StyleSheet.create({
  band: {
    alignSelf: 'stretch',
    height: Sizes.HERO_BAND_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.greenTint
  },
  // The hero's own content layer, so a pressable hero can cover the glyph and the pill while the back button
  // stays that pressable's sibling. It fills the band exactly (flex on the row axis, stretch across it), which
  // is what keeps the centred glyph and the absolutely placed pill where they sat as direct band children.
  content: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  glyph: {
    opacity: Opacity.HERO_ART
  },
  backSlot: {
    position: 'absolute',
    left: Spacing.GUTTER
  },
  contextPill: {
    position: 'absolute',
    bottom: Spacing.MEDIUM,
    left: Spacing.GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.heroScrim
  },
  contextPillLabel: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textSecondary
  }
})
