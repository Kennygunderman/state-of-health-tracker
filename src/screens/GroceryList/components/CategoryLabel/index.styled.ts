import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    paddingTop: Spacing.MEDIUM
  },
  containerFirst: {
    paddingTop: Spacing.GUTTER
  },
  label: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.OVERLINE,
    letterSpacing: LetterSpacing.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  }
})
