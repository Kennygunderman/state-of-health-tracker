import {StyleSheet} from 'react-native'

import {Theme} from '@styles/theme'

// The provider's own element wraps the whole Macros subtree, so it must pass the height through to the
// navigator inside it rather than constrain anything itself.
export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  }
})
