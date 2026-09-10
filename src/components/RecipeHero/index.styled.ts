import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const backButtonPosition = (topInset: number): ViewStyle => ({
  top: topInset + Spacing.X_SMALL
})

export default StyleSheet.create({
  band: {
    alignSelf: 'stretch',
    height: Sizes.HERO_BAND_H,
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
