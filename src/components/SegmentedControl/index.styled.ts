import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const indicatorWidth = (width: number): ViewStyle => ({
  width
})

export default StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.tile,
    borderRadius: BorderRadius.PILL,
    padding: Sizes.SEGMENT_TRACK_INSET
  },
  trackLarge: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: Sizes.CONTROL_SM
  },
  trackCompact: {
    alignSelf: 'flex-start'
  },
  indicator: {
    position: 'absolute',
    top: Sizes.SEGMENT_TRACK_INSET,
    bottom: Sizes.SEGMENT_TRACK_INSET,
    left: Sizes.SEGMENT_TRACK_INSET,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.card
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.X_SMALL,
    alignItems: 'center'
  },
  segmentCompact: {
    flex: 0,
    paddingVertical: Sizes.SEGMENT_COMPACT_INSET_V,
    paddingHorizontal: Spacing.SMALL
  },
  segmentSelected: {
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.card
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  labelCompact: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.SEMIBOLD
  },
  labelSelected: {
    color: Theme.colors.text
  }
})
