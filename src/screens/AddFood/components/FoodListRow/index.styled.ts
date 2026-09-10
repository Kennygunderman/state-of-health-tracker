import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.ITEM,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    marginHorizontal: Spacing.MEDIUM,
    marginBottom: Spacing.SMALL
  },
  textColumn: {
    flex: 1,
    marginRight: Spacing.SMALL
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.X_SMALL
  },
  nameLine: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto'
  },
  name: {
    fontSize: FontSize.BODY,
    fontWeight: 'bold'
  },
  detail: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted
  },
  subtitle: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    marginTop: Spacing.XX_SMALL
  },
  caloriesText: {
    textAlign: 'right'
  },
  caloriesValue: {
    fontSize: FontSize.H3,
    fontWeight: 'bold'
  },
  caloriesLabel: {
    fontSize: FontSize.OVERLINE,
    color: Theme.colors.textMuted
  }
})
