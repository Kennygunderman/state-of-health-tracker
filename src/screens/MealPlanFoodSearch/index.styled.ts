import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
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
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
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
