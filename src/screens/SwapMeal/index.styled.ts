import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // None of these four states has a footer, and the frames author no trailing space; this inset
  // is ours, so the last card clears the safe area at large text sizes.
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  dateLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  title: {
    marginTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  titleAfterBanner: {
    marginTop: Spacing.GUTTER
  },
  errorBannerWrapper: {
    marginTop: Spacing.MEDIUM
  },
  // The replay's busy indicator, centred under the outcome banner it belongs to: the banner keeps the copy of
  // the outcome being reconciled, so the spinner is the only thing on screen reporting that the same-key
  // request is still in flight. It trails the banner inside the banner's own wrapper, so it opens at the tight
  // inset that keeps the two read as one block rather than at a section's gutter.
  outcomeRetryRow: {
    marginTop: Spacing.SMALL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  currentMealWrapper: {
    marginTop: Spacing.MEDIUM
  },
  // A read's failure replaces the alternatives area rather than heading the screen, so it opens at that
  // area's own inset — the one 13c's spinner row and 13's overline both use — not at the banner inset above
  // the title.
  alternativesBannerWrapper: {
    marginTop: Spacing.GUTTER
  },
  loadingRow: {
    marginTop: Spacing.GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL
  },
  loadingLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  skeletonWrapper: {
    marginTop: Spacing.SMALL
  },
  sectionRow: {
    marginTop: Spacing.GUTTER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionHint: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  // Horizontal inset only: the frame is padding 0/16, so the rows abut the card edges and this
  // 16px inset is what sets each row divider's indent. Serves frames 13 and 13e unchanged.
  alternativesCard: {
    marginTop: Spacing.X_SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  // LABEL (16), not META (18.85): frame 13's footnote declares no line height, so the design
  // resolves the 13px automatic box. META's 18.85 belongs to the explicitly-authored captions.
  footnote: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  emptyCardWrapper: {
    marginTop: Spacing.MEDIUM
  },
  emptyCard: {
    padding: Spacing.GUTTER,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  infoBannerWrapper: {
    marginTop: Spacing.MEDIUM
  }
})
