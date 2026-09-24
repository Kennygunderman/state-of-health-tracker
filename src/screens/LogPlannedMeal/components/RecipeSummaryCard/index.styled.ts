import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM
  },
  textColumn: {
    flex: 1
  },
  overline: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  name: {
    marginTop: Spacing.XX_SMALL,
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  }
})
