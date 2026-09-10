import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.PILL,
    alignItems: 'center',
    justifyContent: 'center'
  },
  failure: {
    width: Sizes.BADGE_DISC_LG,
    height: Sizes.BADGE_DISC_LG,
    backgroundColor: Theme.colors.dangerTint
  },
  noMatch: {
    width: Sizes.BADGE_DISC_LG,
    height: Sizes.BADGE_DISC_LG,
    backgroundColor: Theme.colors.tile
  },
  swapEmpty: {
    width: Sizes.BADGE_DISC,
    height: Sizes.BADGE_DISC,
    backgroundColor: Theme.colors.inset
  },
  dialog: {
    width: Sizes.BADGE_DISC_SM,
    height: Sizes.BADGE_DISC_SM,
    backgroundColor: Theme.colors.dangerTint
  }
})
