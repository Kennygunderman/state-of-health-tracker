import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM,
    rowGap: Spacing.SMALL
  },
  cardStillYours: {
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.accentGreen
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  textColumn: {
    flex: 1
  },
  name: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.BOLD
  },
  meta: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})
