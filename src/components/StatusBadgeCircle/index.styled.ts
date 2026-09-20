import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.PILL,
    flexDirection: 'row',
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
  },
  // Geometrically identical to noMatch on purpose: AAP 0.2.5 gives the unconfirmed outcome 10b's layout and
  // the neutral disc, so only the glyph distinguishes the two. It is a separate key because styles[variant]
  // is the lookup, and because a later change to either state's disc must not silently move the other's.
  unconfirmed: {
    width: Sizes.BADGE_DISC_LG,
    height: Sizes.BADGE_DISC_LG,
    backgroundColor: Theme.colors.tile
  }
})
