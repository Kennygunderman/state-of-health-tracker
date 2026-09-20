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
  // The figure's box is the automatic one (34), not the 32.2 the 28px title beside it authors: node 36:199
  // declares its own height as 34 with no line height of its own, and the figure is what sets this row's
  // height, so 32.2 here lifts the whole lower half of the card it sits in.
  figureStat: {
    fontSize: FontSize.STAT_LG,
    lineHeight: LineHeight.STAT_LG_FIGURE,
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
