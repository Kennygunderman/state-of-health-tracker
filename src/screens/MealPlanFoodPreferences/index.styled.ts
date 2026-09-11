import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const SUGGESTION_SKELETON_HEIGHT = Sizes.CHIP

export const SUGGESTION_SKELETON_WIDTH = Sizes.TILE + Sizes.TILE_SM

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // No horizontal padding and no top inset: both belong to ContentColumn, which wraps this body.
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  subCopy: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  },
  fieldWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  sectionWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  cloudWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  skeletonRow: {
    flexDirection: 'row',
    columnGap: Spacing.X_SMALL
  },
  footerContent: {
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    alignSelf: 'center'
  }
})
