import {DimensionValue, StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Shadow from '@styles/shadow'
import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const buttonTouchable = (width: DimensionValue): ViewStyle => ({
  width
})

export default StyleSheet.create({
  inner: {
    ...Shadow.CTA_GLOW,
    backgroundColor: Theme.colors.accentGreen,
    borderRadius: BorderRadius.INPUT,
    paddingVertical: Spacing.MEDIUM,
    paddingHorizontal: Spacing.SMALL,
    alignItems: 'center'
  },
  innerDisabled: {
    opacity: Opacity.DISABLED
  },
  label: {
    fontWeight: FontWeight.SEMIBOLD,
    fontSize: FontSize.H3,
    color: Theme.colors.white,
    marginLeft: Spacing.XX_SMALL,
    marginRight: Spacing.XX_SMALL
  }
})
