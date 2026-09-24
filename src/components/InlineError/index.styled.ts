import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  /* Figma centres the glyph against the message's line box rather than top-aligning it, which is what places
     the 15 px icon half a pixel below the row's content origin (nodes 46:454 and 46:492 both measure at
     row + 8.5, not row + 8). */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    columnGap: Spacing.TIGHT,
    paddingTop: Spacing.X_SMALL
  },
  /* The error row is a fixed 24 in Figma: X_SMALL of padding above a 16 line box, the automatic leading for
     13 px text. LineHeight.META's 18.85 is the multi-line meta value and would draw every error row 2.85
     taller than designed, displacing everything beneath it on each screen that shows one. */
  message: {
    flex: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.danger
  }
})
