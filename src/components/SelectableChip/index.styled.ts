import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
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
