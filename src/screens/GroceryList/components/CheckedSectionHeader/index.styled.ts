import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER
  },
  title: {
    flexShrink: 1,
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.OVERLINE,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  },
  caption: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    textAlign: 'right',
    color: Theme.colors.textMuted
  }
})
