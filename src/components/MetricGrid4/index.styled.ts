import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    columnGap: Spacing.SMALL
  },
  cell: {
    flex: 1,
    rowGap: Spacing.XX_SMALL
  },
  caption: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  value: {
    fontSize: FontSize.STAT,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  }
})
