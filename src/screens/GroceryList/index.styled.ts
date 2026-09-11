import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  /* BLITZY [SPACING]: 37:23 declares 0; this footer-less list keeps an inset so its last row stays reachable. */
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.X_LARGE
  },
  // 37:377 centres the empty body in the column's full remaining height, so the list's bottom inset is dropped there.
  listContentEmpty: {
    flexGrow: 1
  },
  // ContentColumn owns the column's 8px top inset (37:23), so the back row adds no top margin.
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  backLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  title: {
    marginTop: Spacing.XX_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.MEDIUM
  },
  // 37:32 puts the overline and the title in one column beside the action, so the title wraps instead of crowding it.
  headerStack: {
    flexShrink: 1
  },
  // 37:371 drops the row entirely when no action exists, leaving the overline as a plain block on the same 16px rung.
  overlineBlock: {
    marginTop: Spacing.MEDIUM
  },
  /* BLITZY [A11Y]: 37:42 is a bare text action, so its 44px target comes from hitSlop, never from padding. */
  uncheckAllButton: {
    alignSelf: 'center'
  },
  uncheckAllLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  bannerContainer: {
    marginTop: Spacing.MEDIUM
  },
  // Every card carries its own 8px top margin (37:338 for the checked card), so the
  // checked block needs no wrapper: CheckedSectionHeader owns 37:253's full 20px inset.
  sectionCard: {
    marginTop: Spacing.X_SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  // 37:377 centres its narrower children, so it takes the column's full width from the list and centres inside it.
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    backgroundColor: Theme.colors.dangerTint,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.dangerBorder,
    borderRadius: BorderRadius.TIP
  },
  errorTitle: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  errorRetryPill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.SMALL,
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.TILE
  },
  errorRetryLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  skeletonRow: {
    marginTop: Spacing.SMALL
  }
})
