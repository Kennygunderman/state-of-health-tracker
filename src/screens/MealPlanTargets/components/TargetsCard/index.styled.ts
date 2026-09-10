import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
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
    alignSelf: 'stretch'
  },
  editLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  figureWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  estimatePairRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: Spacing.X_SMALL
  },
  estimateFigure: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  dividerWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.SMALL
  },
  divider: {
    alignSelf: 'stretch',
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  legendWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  captionWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  caption: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})
