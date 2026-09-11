import {StyleSheet} from 'react-native'

import {Sizes} from '@styles/sizes'

export default StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  boxSmall: {
    width: Sizes.SPINNER,
    height: Sizes.SPINNER
  },
  boxLarge: {
    width: Sizes.SPINNER_LG,
    height: Sizes.SPINNER_LG
  }
})
