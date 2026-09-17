import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import {ACTION_BAR_RESERVE, actionBarReserve} from './components/ActionBar/index.styled'

// The bar is pinned over the scroll view rather than inside it, so the content has to reserve the bar's own
// height or the last row of a long recipe can never be scrolled clear of it. Both reserves come from the bar's
// own module rather than being recomputed here: the bar's height is its top stroke, its top padding, its
// action row and its bottom inset, and a copy of that sum here drifted from the row the moment the row grew.
export const scrollBottomReserve = (bottomInset: number): ViewStyle => ({
  paddingBottom: actionBarReserve(bottomInset)
})

// The loading placeholder's dimensions. Skeleton sizes its shimmer sweep from a numeric width rather than a
// style, so the one measured value it needs — the content column's live width — is resolved from tokens here
// instead of leaving arithmetic over Spacing and Sizes in the screen.
export const HERO_PLACEHOLDER_HEIGHT = Sizes.HERO_BAND_H

export const PLACEHOLDER_RADIUS = BorderRadius.CARD_LG

export const PLACEHOLDER_ROW_HEIGHTS: readonly number[] = [Sizes.CONTROL_LG, Sizes.CONTROL, Sizes.SKELETON_BAR]

// Both page gutters, so what is left is the content column's inner width. Named because the placeholder width
// is the live column width, and the design system admits no numeric literal — not even a multiplier — into a
// style value.
const PAGE_GUTTERS = Spacing.GUTTER + Spacing.GUTTER

export const placeholderWidth = (windowWidth: number): number =>
  Math.min(windowWidth, Sizes.CONTENT_MAX_WIDTH) - PAGE_GUTTERS

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
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
  // Figma 49:563 sets this label in the 13px regular meta style, sentence case, not the 11px uppercase eyebrow
  // the metric captions below it use — so it takes no letter spacing and no textTransform.
  nutritionCardLabel: {
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
  // A virtualized cell is laid out on its own, outside the content column, so each row and each section header
  // carries the column rule itself: the 20 px gutters, and the 600 px cap centred on a tablet.
  listColumn: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    paddingHorizontal: Spacing.GUTTER
  },
  // The rung the frame draws between rows and above the first one. A container `rowGap` cannot do it here for
  // the same reason the column cannot: nothing lays the cells out together.
  listRow: {
    marginTop: Spacing.SMALL
  },

  bannerBlock: {
    alignSelf: 'stretch',
    marginTop: Spacing.SMALL
  },

  skeletonBlock: {
    alignSelf: 'stretch',
    rowGap: Spacing.SMALL,
    marginTop: Spacing.SMALL
  },
  errorBlock: {
    alignSelf: 'stretch',
    marginTop: Spacing.GUTTER
  }
})
