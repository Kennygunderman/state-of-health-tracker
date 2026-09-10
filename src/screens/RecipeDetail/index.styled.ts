import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

const ACTION_BAR_RESERVE = Spacing.SMALL + Sizes.CTA + Sizes.FOOTER_MIN_BOTTOM

// The action bar is pinned outside the scroll view, so nothing else can pad it away
// from the home indicator: the design's bottom inset is the floor and the live safe-area
// inset wins whenever the device asks for more.
export const actionBarPadding = (bottomInset: number): ViewStyle => ({
  paddingBottom: Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)
})

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: ACTION_BAR_RESERVE
  },

  title: {
    marginTop: Spacing.SMALL,
    fontSize: FontSize.STAT_LG,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.STAT_LG,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.X_SMALL,
    rowGap: Spacing.X_SMALL,
    marginTop: Spacing.SMALL
  },
  badgeCaption: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },

  nutritionCard: {
    alignSelf: 'stretch',
    padding: Spacing.MEDIUM,
    marginTop: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  nutritionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  nutritionOverline: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  portionValue: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.accentGreen
  },
  divider: {
    alignSelf: 'stretch',
    height: Stroke.THIN,
    marginVertical: Spacing.SMALL,
    backgroundColor: Theme.colors.hairline
  },
  provenanceCaption: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.GUTTER
  },
  sectionHeading: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  standaloneSectionHeading: {
    marginTop: Spacing.GUTTER
  },
  ingredientList: {
    alignSelf: 'stretch',
    rowGap: Spacing.SMALL,
    marginTop: Spacing.SMALL
  },
  instructionList: {
    alignSelf: 'stretch',
    rowGap: Spacing.SMALL,
    marginTop: Spacing.SMALL
  },

  skeletonBlock: {
    alignSelf: 'stretch',
    rowGap: Spacing.SMALL,
    marginTop: Spacing.SMALL
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  errorBlock: {
    alignSelf: 'stretch',
    marginTop: Spacing.GUTTER
  }
})
