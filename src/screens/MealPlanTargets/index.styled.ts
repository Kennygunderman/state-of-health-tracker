import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // Deliberately not @components/Screen: its 16px side margins would compound with
  // ContentColumn's 20px gutter and shrink the content column from 353px to 321px.
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    paddingBottom: Spacing.MEDIUM
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  headerLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  // 34:208 declares this block at 353x51 while its pinned line height resolves to 34.5, so the remainder
  // closes the block on Figma's integer height the same way the editor's structurally identical headline
  // does — without it every element below sits 0.5 short of the drawn ladder.
  headline: {
    paddingTop: Spacing.MEDIUM,
    paddingBottom: Sizes.TITLE_BLOCK_INSET_B,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },

  targetsCardWrapper: {
    paddingTop: Spacing.MEDIUM
  },
  // Caption 34:80 is a sibling of card 34:35, not a child of it: it is the 4th of 8 children of the content
  // column, so it renders on the page fill at the 353px gutter measure rather than on the card fill at 313.
  targetsCaptionWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  // LineHeight.LABEL, not META: 34:80 carries the 13px style whose line height Figma leaves automatic and
  // resolves to exactly 16 — which wrapper 34:79 confirms a second way, being 8 padding plus a 16 line box.
  // META's 18.85 would over-lead it and push everything below the card down by 3px.
  targetsCaption: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  planStartsCardWrapper: {
    paddingTop: Spacing.MEDIUM
  },
  answersOverlineWrapper: {
    paddingTop: Spacing.GUTTER
  },
  answersCardWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  answersCard: {
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },

  skeletonGroup: {
    paddingTop: Spacing.MEDIUM,
    rowGap: Spacing.MEDIUM
  },
  skeletonStretch: {
    width: '100%'
  },
  bannerWrapper: {
    paddingTop: Spacing.MEDIUM
  },

  sheetContainer: {
    alignSelf: 'stretch'
  },
  sheetTitle: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  sheetStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.SMALL
  },
  sheetStepButton: {
    width: Sizes.CONTROL,
    height: Sizes.CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.BUTTON
  },
  sheetStepButtonDisabled: {
    opacity: Opacity.DISABLED
  },
  sheetDateLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text,
    textAlign: 'center'
  },
  sheetFooter: {
    paddingTop: Spacing.MEDIUM
  }
})
