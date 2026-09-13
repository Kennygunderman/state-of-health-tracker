import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  /* BLITZY [A11Y]: the default boundary implements Figma `46:302` exactly — an `inputBorder` stroke on the
     `inset` fill — measuring 1.12:1, with the field itself 1.28:1 against the page, so an unfocused field
     has no boundary identifiable at the 3:1 non-text minimum. Figma specifies both values, and every
     surface-to-surface pair in this palette sits below 1.5:1 by design, so only the stroke can move:
     `textFaint` as the border measures 3.31:1 and `textMuted` 4.12:1. The focused and error states below
     do clear the threshold (`accentGreen` 5.98:1 and `danger` 4.41:1 against the fill they sit on), so
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
     text). Figma specifies it and outranks that default, so TextInput is left exact rather than lightened;
     `textSecondary` would reach 6.01:1 and 5.95:1 respectively, and `textMuted` only 4.12:1. Because that
     prop is shared app-wide, the change belongs to the accessible-colour register in `@styles/theme`
     rather than to this field. */
  inputPlaceholder: {
    fontWeight: FontWeight.REGULAR
  },
  inputDisabled: {
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textFaint
  },
  unit: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  }
})
