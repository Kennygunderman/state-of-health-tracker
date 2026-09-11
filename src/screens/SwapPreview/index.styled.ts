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
  subtitle: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },

  thisMealSection: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    rowGap: Spacing.SMALL,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },

  totalsCard: {
    marginTop: Spacing.SMALL,
    padding: Spacing.GUTTER,
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
