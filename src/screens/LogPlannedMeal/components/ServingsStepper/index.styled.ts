import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Opacity, Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingTop: Spacing.X_SMALL
  },
  stepButton: {
    width: Sizes.CONTROL,
    height: Sizes.CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.BUTTON
  },
  stepButtonDisabled: {
    opacity: Opacity.DISABLED
  },
  bar: {
    width: Sizes.STEPPER_BAR_W,
    height: Sizes.STEPPER_BAR_H,
    backgroundColor: Theme.colors.text,
    borderRadius: BorderRadius.SEGMENT
  },
  barCrossing: {
    position: 'absolute',
    width: Sizes.STEPPER_BAR_H,
    height: Sizes.STEPPER_BAR_W,
    backgroundColor: Theme.colors.text,
    borderRadius: BorderRadius.SEGMENT
  },
  field: {
    flex: 1,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    textAlign: 'center',
    fontSize: FontSize.STAT,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.inset,
    borderRadius: BorderRadius.BUTTON,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.inputBorder
  },
  fieldFocused: {
    borderColor: Theme.colors.accentGreen
  }
})
