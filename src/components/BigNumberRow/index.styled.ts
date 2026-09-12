import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  figure: {
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  figureHero: {
    fontSize: FontSize.STAT_HERO,
    letterSpacing: LetterSpacing.HERO
  },
  figureStat: {
    fontSize: FontSize.STAT_LG,
    lineHeight: LineHeight.STAT_LG,
    letterSpacing: LetterSpacing.TITLE
  },
  unit: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})
