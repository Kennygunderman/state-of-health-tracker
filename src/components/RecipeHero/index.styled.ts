import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma places the hero back button 4px below the 50px status band it draws (y 54) — 4px higher than the
// plain back rows elsewhere in the flow. That band is never drawn here, so the live inset replaces it.
export const backButtonPosition = (topInset: number): ViewStyle => ({
  top: topInset + Spacing.XX_SMALL
})

export default StyleSheet.create({
  band: {
    alignSelf: 'stretch',
    height: Sizes.HERO_BAND_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.greenTint
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
