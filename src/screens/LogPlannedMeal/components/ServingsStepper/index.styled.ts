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
    // 50px, not the buttons' 44: node 38:55 hugs to 1 stroke + 12 pad + 24 line box + 12 pad + 1
    // stroke, and row 38:52's own authored height of 58 only balances as 8 padding + 50, so the
    // field is taller than the buttons by design and the row centres them against it. Pinned rather
    // than left to hug because that 24px line box is Figma's AUTO value and would drift per
    // platform; with the height pinned, the authored 12px vertical padding reproduces the stack
    // exactly (50 - 2 strokes - 24 pad = the 24px line box) and cannot re-inflate the box, so no
    // lineHeight is set on the input. Composed from tokens because no Sizes entry equals 50.
    height: Sizes.CONTROL + Spacing.TIGHT,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    textAlign: 'center',
    textAlignVertical: 'center',
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
