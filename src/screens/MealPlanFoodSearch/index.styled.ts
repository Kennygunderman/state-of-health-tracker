import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // Screen spreads its props after `style`, so passing this replaces its own
  // horizontal margins — ContentColumn owns the gutter and must not double it.
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  keyboardAvoider: {
    flex: 1
  },
  resultsSection: {
    paddingTop: Spacing.GUTTER
  },
  // 47:454 owns the overline-to-card rung; the overline renders inside listContent, which cannot supply it.
  resultsListWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  listContent: {
    paddingBottom: Spacing.LARGE
  },
  // 13c loads one card whose rows are divided by a hairline, which is the shape the results card itself
  // takes: the placeholder therefore carries the card and the rows carry the divider, never a card each.
  skeletonCard: {
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  skeletonBar: {
    borderRadius: BorderRadius.CHECKBOX,
    backgroundColor: Theme.colors.inset
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL
  },
  skeletonRowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  skeletonTextColumn: {
    flex: 1,
    rowGap: Spacing.XX_SMALL
  },
  selectedSection: {
    paddingTop: Spacing.GUTTER
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL
  },
  // 47:431 declares this rung on the chips row; SelectedChipsRow carries no top inset, so the screen owns it.
  selectedChipsWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  retryContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.LARGE,
    rowGap: Spacing.XX_SMALL
  },
  /* BLITZY [A11Y]: 47:440 draws this action as a bare 13px label in a row that hugs it, so hit slop is
     clipped away by that row and the label alone is the target. It therefore carries the 44px minimum AAP
     0.7.2 requires in its own layout, which renders the header row 44px tall — flagged for designer review. */
  clearAllButton: {
    justifyContent: 'center',
    minHeight: Sizes.TOUCH_TARGET
  },
  clearAllLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  emptyCaption: {
    paddingVertical: Spacing.LARGE,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    textAlign: 'center',
    color: Theme.colors.textMuted
  },
  retryMessage: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center'
  },
  retryAction: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.accentGreen
  }
})
