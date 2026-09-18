import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  scene: {
    backgroundColor: Theme.colors.background
  },
  tabBarLabel: {
    fontSize: FontSize.TAB_LABEL,
    fontWeight: FontWeight.SEMIBOLD
  },
  tabBar: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline,
    backgroundColor: Theme.colors.navBar
  },
  // The shown bar states `display: 'flex'` explicitly, as the navigator option did before this stylesheet
  // existed, so the option is a registered style in both states rather than a falsy slot in the array.
  tabBarVisible: {
    display: 'flex'
  },
  tabBarHidden: {
    display: 'none'
  }
})
