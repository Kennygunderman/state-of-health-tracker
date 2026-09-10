import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {LineHeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL
  },
  targetText: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  // Carries the gap below the figure row as well: Figma owns it on the divider's own
  // wrapper frame, which this six-key sheet deliberately does not have, and paddingTop
  // cannot open space above a node whose height is fixed at one pixel.
  figureRow: {
    paddingTop: Spacing.X_SMALL,
    paddingBottom: Spacing.SMALL
  },
  divider: {
    height: Stroke.THIN,
    backgroundColor: Theme.colors.hairline
  },
  legend: {
    paddingTop: Spacing.X_SMALL
  }
})
