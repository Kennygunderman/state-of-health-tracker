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
  /* Node 47:451 declares no line height, so Figma resolves the automatic 13px box — 16 — and its wrapper
     47:450 is a fixed 353 x 24 that cannot absorb more: X_SMALL + 16 closes it exactly. LineHeight.META's
     18.85 belongs to the multi-line meta style the result rows declare explicitly (47:385 and its siblings,
     via style_380213a2) and would draw this single line at 26.85 in a wrapper with 24 to give. */
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  /* Not the helper's 16: this caption has no Figma node (the empty result state is inferred) and wraps —
     "No foods match '<query>'" runs past one line on a narrow device — so it keeps the authored multi-line
     meta leading. */
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
