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
  // badgeBlock alone hugs its content, which is what contentBlockCentered displaces: the 64px disc is the
  // only node 10 and 10b centre horizontally. Every other block keeps the full content width and centres
  // its text instead (textCentered), because alignItems: 'center' on the parent would otherwise shrink each
  // wrapper to its content and pull the stretched summaryCard in with it.
  badgeBlock: {
    paddingTop: Spacing.SMALL
  },
  headlineBlock: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  headlineBlockPending: {
    alignSelf: 'stretch',
    paddingTop: Spacing.LARGE
  },
  bodyBlock: {
    alignSelf: 'stretch',
    paddingTop: Spacing.SMALL
  },
  cardBlock: {
    alignSelf: 'stretch',
    paddingTop: Spacing.LARGE
  },
  constraintCardBlock: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  bannerBlock: {
    alignSelf: 'stretch',
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
