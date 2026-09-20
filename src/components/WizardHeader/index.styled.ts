import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
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
  /* Nodes 46:289, 46:165 and 47:145 leave this counter's line height unset, and Figma resolves the automatic
     13px box to 16 — the box every other 13px style in the flow is pinned at. The counter hugs with no
     padding of its own inside a centred row, so pinning 16 centres it exactly as drawn, where the platform
     font's 1.21 multiplier would centre a 15.73 box half a pixel high. */
  counter: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
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
