import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // 37:253 declares no gap: space-between alone separates the two children
    justifyContent: 'space-between',
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
    // 37:258 aligns left inside its hug-width box; the row's space-between puts it on the right edge
    color: Theme.colors.textMuted
  }
})
