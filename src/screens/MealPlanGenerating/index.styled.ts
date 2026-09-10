import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  // The page fill lives here rather than coming from @components/Screen: Screen's
  // horizontal margins would compose with ContentColumn's padding and narrow the
  // content column past the width the design specifies.
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  scrollContentCentered: {
    justifyContent: 'center'
  },
  contentBlock: {
    alignSelf: 'stretch'
  },
  contentBlockCentered: {
    alignItems: 'center'
  },
  badgeBlock: {
    paddingTop: Spacing.SMALL
  },
  headlineBlock: {
    paddingTop: Spacing.GUTTER
  },
  headlineBlockPending: {
    paddingTop: Spacing.LARGE
  },
  bodyBlock: {
    paddingTop: Spacing.SMALL
  },
  cardBlock: {
    paddingTop: Spacing.LARGE
  },
  constraintCardBlock: {
    paddingTop: Spacing.GUTTER
  },
  bannerBlock: {
    paddingTop: Spacing.MEDIUM
  },
  headline: {
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  headlineAlternate: {
    fontSize: FontSize.STAT_LG,
    lineHeight: LineHeight.STAT_LG
  },
  body: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  textCentered: {
    textAlign: 'center'
  },
  summaryCard: {
    alignSelf: 'stretch',
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  }
})
