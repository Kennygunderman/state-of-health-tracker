import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    alignSelf: 'stretch'
  },
  inner: {
    minHeight: Sizes.CTA,
    paddingVertical: Spacing.MEDIUM,
    paddingHorizontal: Spacing.SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  innerDisabled: {
    opacity: Opacity.DISABLED
  },
  label: {
    fontSize: FontSize.H3,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'center',
    color: Theme.colors.textSecondary
  }
})
