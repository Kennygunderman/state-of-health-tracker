import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
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
