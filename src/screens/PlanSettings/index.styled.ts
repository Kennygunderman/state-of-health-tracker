import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// The screen gutter and iPad cap belong to ContentColumn, the pinned footer's
// padding, fill, hairline and safe-area inset to SetupFooter, and the row and
// dialog internals to SettingsRow and PlanConfirmDialog. Nothing here restates
// them, so no footer or gutter key exists below.
export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  content: {
    flex: 1
  },
  contentDimmed: {
    opacity: Opacity.CONTENT_DIM
  },
  // Breathing room below the footnote at full scroll. The frame declares 0 here,
  // but only because its card is shortened to clip the last row; with the card
  // hugging, the seam takes this region's own block rhythm instead.
  scrollContent: {
    paddingBottom: Spacing.MEDIUM
  },
  backRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  bannerWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.MEDIUM
  },
  cardWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.MEDIUM
  },
  // Hug height: the seven rows size the card and the screen scrolls, so the
  // frame's fixed height, which clips the last row in the mock, is not carried.
  settingsCard: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.MEDIUM,
    overflow: 'hidden',
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  footnoteWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  skeletonWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.MEDIUM,
    rowGap: Spacing.SMALL
  },
  errorCard: {
    alignSelf: 'stretch',
    paddingTop: Spacing.MEDIUM
  },
  backLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  title: {
    alignSelf: 'stretch',
    marginTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  // Single line at the design's auto leading; LineHeight.META would stretch it.
  footnote: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  }
})
