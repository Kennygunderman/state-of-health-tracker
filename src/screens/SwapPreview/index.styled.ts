import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

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

  skeletonBlock: {
    paddingTop: Spacing.MEDIUM,
    rowGap: Spacing.SMALL
  },
  skeletonRow: {
    flexDirection: 'row',
    columnGap: Spacing.SMALL
  },
  skeletonFill: {
    flex: 1
  },

  errorBlock: {
    paddingTop: Spacing.MEDIUM
  }
})
