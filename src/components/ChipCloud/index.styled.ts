import {StyleSheet} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

export default StyleSheet.create({
  // A chip owns its own height (vertical padding around its line box), so a chip whose label wraps must not
  // stretch the rest of its line to match: the cross axis centres instead of taking the default stretch.
  cloud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.X_SMALL
  },
  // React Native's horizontal ScrollView base style is flexGrow: 1, which would stretch a single chip row down
  // the whole column-direction screen body it sits in. The band is also held at the 44px minimum: a scroll view
  // rejects touches outside its own bounds, so a shorter band would clip the touch target of the chips it holds.
  scroll: {
    flexGrow: 0,
    minHeight: Sizes.TOUCH_TARGET
  },
  wrap: {
    flexWrap: 'wrap'
  }
})
