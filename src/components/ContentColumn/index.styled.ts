import {StyleSheet} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

export default StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    paddingTop: Spacing.X_SMALL,
    paddingHorizontal: Spacing.GUTTER
  }
})
