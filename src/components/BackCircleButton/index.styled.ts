import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  button: {
    width: Sizes.TILE_SM,
    height: Sizes.TILE_SM,
    borderRadius: BorderRadius.PILL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  default: {
    backgroundColor: Theme.colors.tile
  },
  scrim: {
    backgroundColor: Theme.colors.heroScrim
  }
})
