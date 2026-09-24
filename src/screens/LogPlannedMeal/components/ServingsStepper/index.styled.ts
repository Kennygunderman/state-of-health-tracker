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
    // 50px, not the buttons' 44: node 38:55 authors no dimensions at all — it is sizing.vertical
    // "hug", and 50 is what it resolves to from 1 stroke + 12 pad + 24 line box + 12 pad + 1
    // stroke, while row 38:52's own authored height of 58 only balances as 8 padding + 50. So the
    // field is taller than the buttons by design, and a minimum rather than a fixed height is what
    // the design actually says. No lineHeight is set on the input: Figma's line height here is AUTO
    // and an RN lineHeight is a raw dp value that does not follow the OS font scale, so pinning it
    // would clip scaled text. minHeight reproduces the resting 50 for any platform line box up to
    // 24 and lets the field grow past it. Composed from tokens because no Sizes entry equals 50.
    minHeight: Sizes.CONTROL + Spacing.TIGHT,
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
  },
  // The stroke goes to the field's own fill, so a locked field reads as the value it is rather than as an input
  // waiting for one. The number itself keeps its colour: it is what the pending write will log, and it has to
  // stay legible — only the affordance is withdrawn, which the dimmed buttons beside it carry.
  fieldDisabled: {
    borderColor: Theme.colors.inset
  }
})
