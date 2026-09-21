import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  /* BLITZY [A11Y]: the default boundary implements Figma `46:302` exactly — an `inputBorder` stroke on the
     `inset` fill — measuring 1.12:1, with the field itself 1.28:1 against the page, so an unfocused field
     has no boundary identifiable at the 3:1 non-text minimum. Figma specifies both values, and the project
     directive's accessibility rule requires a Figma-specified pair to be matched exactly and flagged for
     designer review rather than raised, so it is matched and flagged. Every surface-to-surface pair in
     this palette sits below 1.5:1 by design, so only the stroke can move:
     `textFaint` as the border measures 3.31:1 and `textMuted` 4.12:1. The focused and error states below
     do clear the threshold (`accentGreen` 5.97:1 and `danger` 4.41:1 against the fill they sit on), so
     this affects the resting state only. See the accessible-colour register in `@styles/theme`. */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    minHeight: Sizes.CONTROL_LG,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.INPUT,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.inputBorder,
    backgroundColor: Theme.colors.inset
  },
  containerFocused: {
    borderColor: Theme.colors.accentGreen
  },
  containerError: {
    borderColor: Theme.colors.danger,
    backgroundColor: Theme.colors.dangerTint
  },
  input: {
    flex: 1,
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    fontSize: FontSize.H2,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  /* BLITZY [A11Y]: this key sets the placeholder weight only — the colour arrives from the shared TextInput,
     which applies `placeholderTextColor={Theme.colors.textFaint}` for every field in the app. That paint
     implements Figma `47:280` and `46:448` exactly and measures 3.31:1 on the `inset` fill and 3.28:1 in
     the error state's `dangerTint`, below the 4.5:1 AA default (Figma's 400/18px does not qualify as large
     text). Figma specifies it, and the project directive's accessibility rule requires a Figma-specified
     pair to be matched exactly and flagged for designer review rather than lightened, so TextInput is left
     exact; `textSecondary` would reach 6.01:1 and 5.95:1 respectively, and `textMuted` only 4.12:1. No
     field's identity rests on this paint — `TextField` requires an `accessibilityLabel` and forwards it to
     the input, so assistive technology reads the purpose from the label, and the gap is the sighted
     low-vision case only. Because that prop is shared app-wide, the change belongs to the
     accessible-colour register in `@styles/theme` rather than to this field. */
  inputPlaceholder: {
    fontWeight: FontWeight.REGULAR
  },
  inputDisabled: {
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textFaint
  },
  /* BLITZY [A11Y]: the unit suffix implements Figma `46:197` exactly — `textMuted` 400 15 inside the `inset`
     container declared above (also `34:220`, `34:246`, `47:639`) — measuring 4.12:1 against the 4.5:1 AA
     default, 15px regular being well short of large text. That is the same 4.12:1 the two markers above
     name as a remedy candidate for the border and the placeholder; on this key it is the pair actually
     rendered, in every form that passes a `unit`. Figma specifies it and outranks the default, so it is
     matched rather than lightened; `textSecondary` on this fill measures 6.01:1 and `text` 13.02:1, the
     latter giving up the suffix's subordination to the value it follows. The suffix is drawn and never
     announced (see `index.tsx`), so the gap is the sighted low-vision case only. See entry 9 of the
     accessible-colour register in `@styles/theme`. */
  unit: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  }
})
