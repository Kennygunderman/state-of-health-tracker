import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  cardFlagged: {
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.danger
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.SMALL
  },
  metaLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL
  },
  metaText: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  metaCalories: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingBottom: Spacing.SMALL
  },
  tileMuted: {
    opacity: Opacity.LOGGED_TILE
  },
  textColumn: {
    flex: 1
  },
  recipeName: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  recipeNameLogged: {
    color: Theme.colors.textSecondary
  },
  recipeMeta: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  flagText: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.danger
  },
  swappedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.TIGHT
  },
  swappedCaption: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  swappedLink: {
    flexShrink: 0,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  actionRow: {
    flexDirection: 'row',
    columnGap: Spacing.X_SMALL,
    paddingVertical: Spacing.SMALL,
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  pillSecondary: {
    flex: 1,
    height: Sizes.PILL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.inset
  },
  pillPrimary: {
    flex: 1,
    height: Sizes.PILL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  pillLabelSecondary: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.textSecondary
  },
  pillLabelPrimary: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.accentGreen
  }
})
