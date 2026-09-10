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
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },

  targetsCardWrapper: {
    paddingTop: Spacing.MEDIUM
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
