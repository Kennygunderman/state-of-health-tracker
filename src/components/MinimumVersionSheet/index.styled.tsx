import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import Shadow from '@styles/shadow'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.colors.sheetScrim
  },
  backdropTouchableArea: {
    flex: 1
  },
  // The sheet's own surface, passed to BottomSheet's backgroundStyle. Named here rather than written inline at
  // the call site so the component carries no style object of its own.
  sheetBackground: {
    backgroundColor: Theme.colors.background
  },
  sheetShadow: {
    ...Shadow.SHEET
  },
  sheetContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.GUTTER
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: FontWeight.BOLD
  },
  desc: {
    marginVertical: Spacing.LARGE,
    fontSize: FontSize.PARAGRAPH,
    fontWeight: FontWeight.EXTRA_LIGHT
  },
  button: {
    marginBottom: Spacing.XX_LARGE
  }
})
