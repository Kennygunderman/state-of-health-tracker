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
    gap: Spacing.SMALL
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Sizes.CONTROL,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    gap: Spacing.X_SMALL,
    borderRadius: BorderRadius.PILL,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.inputBorder,
    backgroundColor: Theme.colors.inset
  },
  fieldFocused: {
    borderColor: Theme.colors.accentGreen
  },
  input: {
    flex: 1,
    padding: 0,
    borderRadius: 0,
    borderWidth: 0,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    backgroundColor: 'transparent'
  },
  valueLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  placeholderLabel: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textFaint
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: Sizes.ICON,
    height: Sizes.ICON,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.textDisabled
  },
  clearGlyph: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.background
  },
  cancelLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  }
})
