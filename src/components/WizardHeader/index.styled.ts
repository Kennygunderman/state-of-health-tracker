import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.SMALL
  },
  counter: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.XX_SMALL
  },
  segment: {
    flex: 1,
    height: Sizes.PROGRESS_SEGMENT_H,
    borderRadius: BorderRadius.SEGMENT,
    backgroundColor: Theme.colors.track
  },
  segmentFilled: {
    backgroundColor: Theme.colors.accentGreen
  }
})
