import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    borderWidth: Stroke.DEFAULT,
    borderStyle: 'dashed',
    borderColor: Theme.colors.dashedBorder,
    borderRadius: BorderRadius.ITEM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.SMALL,
    alignSelf: 'stretch'
  },
  message: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary,
    textAlign: 'center'
  }
})
