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
  // The press envelope, not a drawn surface: it is the minimum touch target tall and gives both of
  // its insets back as a negative margin, so it occupies the drawn track's height in layout while
  // each option inside it is a full-height target that nothing clips.
  envelope: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: Sizes.TOUCH_TARGET,
    paddingHorizontal: Sizes.SEGMENT_TRACK_INSET
  },
  envelopeLarge: {
    alignSelf: 'stretch',
    marginVertical: -Sizes.SEGMENT_ENVELOPE_INSET_V
  },
  envelopeCompact: {
    alignSelf: 'flex-start',
    marginVertical: -Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V
  },
  trackSurface: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.tile,
    borderRadius: BorderRadius.PILL
  },
  trackSurfaceLarge: {
    top: Sizes.SEGMENT_ENVELOPE_INSET_V,
    bottom: Sizes.SEGMENT_ENVELOPE_INSET_V
  },
  trackSurfaceCompact: {
    top: Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V,
    bottom: Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V
  },
  indicator: {
    position: 'absolute',
    top: Sizes.SEGMENT_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET,
    bottom: Sizes.SEGMENT_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET,
    left: Sizes.SEGMENT_TRACK_INSET,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.card
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Sizes.SEGMENT_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET
  },
  optionCompact: {
    flex: 0,
    paddingVertical: Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET
  },
  segment: {
    minHeight: Sizes.SEGMENT_H,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.X_SMALL
  },
  segmentCompact: {
    minHeight: Sizes.SEGMENT_COMPACT_H,
    paddingVertical: Sizes.SEGMENT_COMPACT_INSET_V,
    paddingHorizontal: Spacing.SMALL
  },
  segmentSelected: {
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.card
  },
  /* BLITZY [A11Y]: the unselected label implements Figma `49:41` exactly — `textMuted` over the `tile` track
     declared above — measuring 4.40:1 against the 4.5:1 AA default, short by 0.10. Figma gives the
     unselected segment no fill of its own, so the track is the operative backdrop, and it styles both
     labels with one 600/13px token, so there is no weight change on selection to invoke a laxer threshold.
     Figma specifies the pair and outranks that default, so it is matched rather than lightened;
     `textSecondary` on `tile` measures 6.40:1. See the accessible-colour register in `@styles/theme`. */
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
