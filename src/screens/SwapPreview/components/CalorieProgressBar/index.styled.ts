import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

// The fill is bound to the day's real calorie ratio, not the proportion the
// frame happens to draw, so its width cannot be a static style value.
export const fillWidth = (ratio: number): ViewStyle => ({
  width: `${ratio * 100}%`
})

export default StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    height: Sizes.PROGRESS_BAR_H,
    borderRadius: BorderRadius.BAR,
    backgroundColor: Theme.colors.track,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.BAR,
    backgroundColor: Theme.colors.accentGreen
  }
})
