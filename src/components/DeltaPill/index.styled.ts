import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.greenTint
  },
  containerDanger: {
    backgroundColor: Theme.colors.dangerTint
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.greenOnTint
  },
  labelPositive: {
    color: Theme.colors.text
  },
  labelDanger: {
    color: Theme.colors.danger
  }
})
