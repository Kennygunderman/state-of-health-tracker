import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingBottom: Sizes.EMPTY_BLOCK_BOTTOM
  },
  containerInsetLg: {
    paddingBottom: Sizes.EMPTY_BLOCK_BOTTOM_LG
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  tile: {
    width: Sizes.EMPTY_TILE,
    height: Sizes.EMPTY_TILE,
    borderRadius: BorderRadius.EMPTY_TILE,
    backgroundColor: Theme.colors.greenTint
  },
  badge: {
    width: Sizes.BADGE_DISC,
    height: Sizes.BADGE_DISC,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.inset
  },
  headline: {
    alignSelf: 'stretch',
    marginTop: Spacing.GUTTER,
    textAlign: 'center',
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  headlineLarge: {
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE
  },
  headlineCompact: {
    fontSize: FontSize.CARD_TITLE
  },
  body: {
    alignSelf: 'stretch',
    marginTop: Spacing.SMALL,
    textAlign: 'center',
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  },
  action: {
    alignSelf: 'stretch',
    marginTop: Spacing.LARGE
  },
  actionStacked: {
    alignSelf: 'stretch',
    marginTop: Spacing.X_SMALL
  }
})
