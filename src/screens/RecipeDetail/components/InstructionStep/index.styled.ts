import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: Spacing.SMALL
  },
  badge: {
    width: Sizes.STEP_BADGE,
    height: Sizes.STEP_BADGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  stepNumber: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.accentGreen
  },
  instructionText: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.STEP_BODY,
    color: Theme.colors.textSecondary
  }
})
