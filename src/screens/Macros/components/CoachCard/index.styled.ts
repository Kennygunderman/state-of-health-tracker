import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Shadow from '@styles/shadow'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

const ICON_BADGE_SIZE = 48

export default StyleSheet.create({
  card: {
    ...Shadow.CARD,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM,
    columnGap: Spacing.SMALL
  },
  iconBadge: {
    width: ICON_BADGE_SIZE,
    height: ICON_BADGE_SIZE,
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textWrapper: {
    flex: 1
  },
  title: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: '700'
  },
  body: {
    fontSize: FontSize.LABEL,
    color: Theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 18
  },
  subBody: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    marginTop: 2
  },
  manageText: {
    fontSize: FontSize.LABEL,
    fontWeight: '600',
    color: Theme.colors.accentGreen
  }
})
