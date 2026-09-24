import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.greenTint
  },
  tileLg: {
    width: Sizes.TILE,
    height: Sizes.TILE,
    borderRadius: BorderRadius.ITEM
  },
  tileMd: {
    width: Sizes.TILE_SM,
    height: Sizes.TILE_SM,
    borderRadius: BorderRadius.TILE
  }
})
