import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  inner: {
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint,
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    alignItems: 'center',
    flexDirection: 'row'
  },
  innerDark: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: Spacing.MEDIUM,
    paddingHorizontal: 0,
    borderRadius: BorderRadius.BUTTON,
    backgroundColor: Theme.colors.tile
  },
  label: {
    fontWeight: FontWeight.SEMIBOLD,
    fontSize: FontSize.LABEL,
    color: Theme.colors.accentGreen,
    marginLeft: Spacing.XX_SMALL,
    marginRight: Spacing.XX_SMALL
  },
  labelDark: {
    marginLeft: 0,
    marginRight: 0,
    fontSize: FontSize.H3,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  }
})
