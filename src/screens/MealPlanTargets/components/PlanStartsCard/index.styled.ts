import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 0
  },
  textColumn: {
    flex: 1
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    // Figma 34:86 sets an explicit 18.85px line height, the same text style the "kcal" label uses, unlike the
    // auto-height 13px labels of the sibling answers rows, and the card's height derives from it.
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  value: {
    // BLITZY [SPACING]: Figma 34:88 gives this gap 2px; the scale has no 2 step, so it snaps up to XX_SMALL (4),
    // which the AAP assigns to value->label. Alternative: an eighth spacing step, where the AAP stops at seven.
    paddingTop: Spacing.XX_SMALL,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  changeButton: {
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.inset
  },
  changeLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  }
})
