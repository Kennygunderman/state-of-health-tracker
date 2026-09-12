import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Sizes.BADGE_PADDING_V,
    paddingHorizontal: Spacing.X_SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  label: {
    fontSize: FontSize.TAB_LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    color: Theme.colors.greenOnTint
  }
})
