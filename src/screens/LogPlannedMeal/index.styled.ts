import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // Deliberately not @components/Screen: its 16px side margins would compound with
  // ContentColumn's 20px gutter and shrink the content column from 353px to 321px.
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.GUTTER
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  dateOverline: {
    paddingTop: Spacing.SMALL,
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.OVERLINE,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.accentGreen
  },
  title: {
    paddingTop: Spacing.XX_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.SMALL
  },
  dateStepButton: {
    width: Sizes.CONTROL,
    height: Sizes.CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.inset
  },
  dateStepButtonDisabled: {
    opacity: Opacity.DISABLED
  },
  dateLabel: {
    flex: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.text
  },

  bannerSection: {
    paddingTop: Spacing.MEDIUM
  },
  recipeCardSection: {
    paddingTop: Spacing.MEDIUM
  },
  /* Node 38:50 declares no line height, and the box Figma resolves for it is 16: three painted instances of
     the identical style (49:376, 49:379 and 38:188) each hug to 32 over 8/0 padding. Left unset, the label
     would take the platform font's 15.73 and lift the stepper under it. */
  controlLabel: {
    paddingTop: Spacing.GUTTER,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  // Node 38:52's 8px gap under the "Servings" label. The loaded body takes it from ServingsStepper's own row
  // padding, so this is the placeholder's copy of it — applying both would double the gap.
  stepperSection: {
    paddingTop: Spacing.X_SMALL
  },
  chipsSection: {
    paddingTop: Spacing.SMALL
  },

  thisAddsSection: {
    paddingTop: Spacing.MEDIUM
  },
  thisAddsCard: {
    rowGap: Spacing.SMALL,
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },

  slotSection: {
    paddingTop: Spacing.X_SMALL
  },
  bucketFallbackCaption: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})
