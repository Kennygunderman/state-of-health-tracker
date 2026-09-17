import {StyleSheet} from 'react-native'

import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'

export default StyleSheet.create({
  column: {
    rowGap: Spacing.X_SMALL
  },
  // Only the rows that are no longer a choice are dimmed. The selected row is left at full strength because it
  // is the one piece of information this state carries: the bucket the pending write is going to land in.
  rowDisabled: {
    opacity: Opacity.DISABLED
  }
})
