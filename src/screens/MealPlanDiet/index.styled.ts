import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // No horizontal padding: the screen gutter belongs to ContentColumn, which wraps this body.
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  dietGroup: {
    paddingTop: Spacing.GUTTER,
    gap: Spacing.X_SMALL
  },
  /* The same automatic 13px box as the helper below, which is how node 47:175's wrapper closes: 353 x 40 is
     LARGE + 16, so the label's height is entirely this box and leaving it to the platform font's 15.73 would
     lift the allergen cloud under it. */
  sectionLabel: {
    paddingTop: Spacing.LARGE,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  cloudWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  /* Node 47:218 declares no line height — the style is inline, never tokenised — so Figma resolves the
     automatic 13px box of 16, and wrapper 47:322 is a fixed 353 x 24 over 8/0/0 padding that closes on it
     exactly, baseline at y=21.0. The wrapper cannot grow and the single line already consumes 352.67 of the
     353 column with no truncation, so LineHeight.META's 18.85 did not merely draw the block 2.85 too tall —
     it is the multi-line leading applied to a line that has no second line to give. */
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  }
})
