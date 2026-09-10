import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    width: Sizes.ICON_LG,
    height: Sizes.ICON_LG,
    borderRadius: BorderRadius.CHECKBOX,
    borderWidth: Stroke.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Theme.colors.textDisabled
  },
  containerCheckedMuted: {
    backgroundColor: Theme.colors.track,
    borderColor: Theme.colors.track
  },
  containerCheckedEmphasis: {
    backgroundColor: Theme.colors.accentGreen,
    borderColor: Theme.colors.accentGreen
  }
})
