import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    columnGap: Spacing.SMALL
  },
  titleBlock: {
    flex: 1,
    paddingTop: Spacing.X_SMALL,
    rowGap: Spacing.XX_SMALL
  },
  title: {
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  // The target is TOUCH_TARGET wide while the drawn disc stays CONTROL_SM: right-aligning the disc keeps it
  // flush with the content column and grows the target inwards, so it never extends past the row's bounds.
  groceryButton: {
    width: Sizes.TOUCH_TARGET,
    height: Sizes.TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  groceryDisc: {
    width: Sizes.CONTROL_SM,
    height: Sizes.CONTROL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.tile
  }
})
