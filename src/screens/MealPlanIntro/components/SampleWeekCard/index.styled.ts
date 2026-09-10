import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dayStrip: {
    flexDirection: 'row',
    columnGap: Spacing.X_SMALL,
    paddingTop: Spacing.MEDIUM
  },
  dayChip: {
    flex: 1,
    minHeight: Sizes.CHIP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.tile
  },
  dayChipSelected: {
    backgroundColor: Theme.colors.greenTint
  },
  dayChipLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  dayChipLabelSelected: {
    color: Theme.colors.greenOnTint
  },
  mealList: {
    paddingTop: Spacing.MEDIUM,
    rowGap: Spacing.SMALL
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  mealTextColumn: {
    flex: 1
  },
  mealSlotLabel: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.OVERLINE,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  mealName: {
    paddingTop: Spacing.XX_SMALL,
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  mealMeta: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  footer: {
    paddingTop: Spacing.MEDIUM
  },
  divider: {
    height: Stroke.THIN,
    backgroundColor: Theme.colors.hairline
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.MEDIUM
  },
  footerNote: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  footerTotal: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  }
})
