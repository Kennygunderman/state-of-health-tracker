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
    borderRadius: BorderRadius.CHIP,
    padding: Sizes.SEGMENT_TRACK_INSET
  },
  trackLarge: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: Sizes.CONTROL_SM
  },
  trackSmall: {
    alignSelf: 'flex-start'
  },
  trackUnit: {
    alignSelf: 'flex-start'
  },
  indicator: {
    position: 'absolute',
    top: Sizes.SEGMENT_TRACK_INSET,
    bottom: Sizes.SEGMENT_TRACK_INSET,
    left: Sizes.SEGMENT_TRACK_INSET,
    borderRadius: BorderRadius.CHIP,
    backgroundColor: Theme.colors.card
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.X_SMALL,
    borderRadius: BorderRadius.CHIP,
    alignItems: 'center'
  },
  segmentSmall: {
    flex: 0,
    paddingVertical: Sizes.SEGMENT_COMPACT_INSET_V,
    paddingHorizontal: Spacing.SMALL
  },
  segmentUnit: {
    flex: 0,
    paddingVertical: Sizes.SEGMENT_COMPACT_INSET_V,
    paddingHorizontal: Spacing.SMALL
  },
  segmentSelected: {
    backgroundColor: Theme.colors.card
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  labelSmall: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.SEMIBOLD
  },
  labelUnit: {
    fontSize: FontSize.CAPTION,
    fontWeight: FontWeight.SEMIBOLD
  },
  labelSelected: {
    color: Theme.colors.text
  }
})
