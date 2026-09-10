import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Opacity, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL,
    alignSelf: 'stretch'
  },
  rowDivider: {
    // Full-pixel rule, unlike MacroGramRow: hairlineWidth under-renders the design's 1px on 2x/3x screens.
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1
  },
  name: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  subLine: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.danger
  },
  checkboxPending: {
    opacity: Opacity.DISABLED
  }
})
