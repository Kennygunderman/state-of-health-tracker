import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // The pressable host an opted-in chip wears instead of the pill: it reaches the 44px minimum on the axis the
  // 32px pill falls short of, and the pill is centred inside it unchanged. Hit slop cannot do this job where the
  // host hugs the pill, because React Native never delivers a touch outside an ancestor's bounds.
  touchHost: {
    justifyContent: 'center',
    minHeight: Sizes.TOUCH_TARGET,
    maxWidth: '100%',
    flexShrink: 1
  },
  // The chip hugs its label and its 32px height stays derived (vertical padding around the label's line box) —
  // Figma declares neither. maxWidth and flexShrink only engage past the content column, a width Figma never
  // draws: there the pill stops at the column and its label wraps inside, rather than the row overflowing the
  // gutter at large text sizes. Short chips are untouched.
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    flexShrink: 1,
    gap: Spacing.TIGHT,
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.tile
  },
  containerSelected: {
    backgroundColor: Theme.colors.greenTint
  },
  label: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  labelSelected: {
    color: Theme.colors.greenOnTint
  },
  // The glyph never shrinks: it is the chip's only remove affordance, so the label yields the width instead.
  removeGlyph: {
    flexShrink: 0,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.greenOnTint,
    opacity: Opacity.CHIP_GLYPH
  }
})
