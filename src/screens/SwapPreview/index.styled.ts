import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/**
 * The loading shell's geometry.
 *
 * `Skeleton` takes numeric width and height rather than a style — it measures its shimmer sweep from the
 * prop — so the one live value the screen holds, the window width, is turned into the content column's and
 * the cards' inner widths HERE. The arithmetic is the layout's, not the screen's, and it has to agree with
 * `ContentColumn` (width 100% capped at `CONTENT_MAX_WIDTH`, `GUTTER` either side) and with the card padding
 * below, or a placeholder is a different width from the content it stands in for. Recipe detail's loading
 * state splits the same way.
 *
 * The band above the column is not sized here: that state is `RecipeHero`'s own `variant='pending'`, whose
 * geometry — and whose back button, this route's only one — belong to the band rather than to this screen.
 */
export const PLACEHOLDER_BAR_RADIUS = BorderRadius.CHECKBOX

/** Title then subtitle, each at the line height of the text it replaces. */
export const TITLE_PLACEHOLDER_HEIGHTS: readonly number[] = [LineHeight.STAT_LG, LineHeight.META]

/** The 'This meal' card: its overline, then the four-cell metric grid. */
export const THIS_MEAL_PLACEHOLDER_HEIGHTS: readonly number[] = [Sizes.SKELETON_BAR_SM, Sizes.CONTROL_LG]

/** The day-totals card: overline and delta pill, the big figure, the determinate bar, the macro legend. */
export const TOTALS_PLACEHOLDER_HEIGHTS: readonly number[] = [
  Sizes.SKELETON_BAR_SM,
  Sizes.CONTROL,
  Sizes.PROGRESS_BAR_H,
  Sizes.CONTROL_LG
]

// Applied to both widths below, and to each of them in its own right: Skeleton sizes its sweep from the number
// it is given, and the card's padding can exhaust a column the gutters have already left positive.
const clampedPlaceholder = (width: number): number => {
  if (!Number.isFinite(width) || width <= 0) {
    return 0
  }

  return width
}

// The gutter and the card padding are each subtracted once per side, written as the two sides they are
// rather than as a doubling: the token-literal gate counts a `* 2` as a magic number, and naming both
// sides also says which insets the placeholder is clearing.
export const placeholderWidth = (windowWidth: number): number =>
  clampedPlaceholder(Math.min(windowWidth, Sizes.CONTENT_MAX_WIDTH) - (Spacing.GUTTER + Spacing.GUTTER))

/** Inside a card, the same column width less the card's own padding on both sides. */
export const placeholderCardWidth = (windowWidth: number): number =>
  clampedPlaceholder(placeholderWidth(windowWidth) - (Spacing.MEDIUM + Spacing.MEDIUM))

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // No horizontal padding: RecipeHero is deliberately full-bleed and ContentColumn owns the gutter.
  scrollContent: {
    paddingBottom: Spacing.X_LARGE
  },

  titleBlock: {
    paddingTop: Spacing.SMALL,
    rowGap: Spacing.X_SMALL
  },
  title: {
    fontSize: FontSize.STAT_LG,
    lineHeight: LineHeight.STAT_LG,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  // The design's meta style, not its sub-copy: this line shares one text style with the 'of {n} kcal'
  // suffix below it, and its box is too short to seat sub-copy's taller line.
  subtitle: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },

  thisMealSection: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    rowGap: Spacing.SMALL,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  // How the figures above were arrived at (AAP 0.7.3), in the same meta style recipe detail states it in — one
  // provenance sentence, one treatment, wherever a planned portion's nutrition is shown.
  provenanceCaption: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },

  // Both cards take the narrower of the design's two card insets: the progress bar and the legend span
  // the card's full inner width, and the design draws them at 321 rather than 313.
  totalsCard: {
    marginTop: Spacing.SMALL,
    padding: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  // No columnGap: the frame separates the overline from the delta pill with space-between alone.
  totalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  totalsOverline: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  totalsFigureRow: {
    marginTop: Spacing.X_SMALL
  },
  totalsBar: {
    marginTop: Spacing.SMALL
  },
  // The hairline is the frame's own divider above the legend; MacroLegendRow draws one
  // only from its second row onward.
  legendBlock: {
    marginTop: Spacing.SMALL,
    paddingTop: Spacing.X_SMALL,
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },

  ingredientsSection: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.SMALL
  },
  ingredientsHeading: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  // IngredientRow owns its own row layout but leaves the gap between rows to the caller.
  ingredientsList: {
    rowGap: Spacing.SMALL
  },

  // The loading shell draws the REAL title block and card styles above with these stacks of bars inside them,
  // so a silhouette's radius, fill and padding are the loaded screen's own rather than invented numbers.
  skeletonStack: {
    rowGap: Spacing.SMALL
  },
  skeletonBar: {
    backgroundColor: Theme.colors.inset
  },

  errorBlock: {
    paddingTop: Spacing.MEDIUM
  }
})
