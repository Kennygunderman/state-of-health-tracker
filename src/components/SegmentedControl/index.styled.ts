import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import {optionBoxHeightFor, segmentEnvelopeInsetFor, visualTrackHeightFor} from './index.util'

// The envelope geometry is derived here, from the pill heights and the minimum touch target, rather
// than written out as arithmetic over the pre-computed `SEGMENT_*_ENVELOPE_INSET_V` tokens: the
// derivation is what `__tests__/index.util.test.ts` pins, and the tokens are what it pins it against,
// so a change to a pill height, the track inset or the target cannot move the rendered envelope
// without failing a test. The values are unchanged — 36/29 drawn tracks, 4/7.5 insets, 44 targets.
const LARGE_TRACK_H = visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)
const COMPACT_TRACK_H = visualTrackHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_TRACK_INSET)
const LARGE_ENVELOPE_INSET_V = segmentEnvelopeInsetFor(LARGE_TRACK_H, Sizes.TOUCH_TARGET)
const COMPACT_ENVELOPE_INSET_V = segmentEnvelopeInsetFor(COMPACT_TRACK_H, Sizes.TOUCH_TARGET)
const LARGE_OPTION_BOX_H = optionBoxHeightFor(Sizes.SEGMENT_H, LARGE_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)
const COMPACT_OPTION_BOX_H = optionBoxHeightFor(
  Sizes.SEGMENT_COMPACT_H,
  COMPACT_ENVELOPE_INSET_V,
  Sizes.SEGMENT_TRACK_INSET
)
// From the envelope's edge to the drawn pill: across the envelope inset and then the track inset.
const LARGE_PILL_INSET_V = LARGE_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET
const COMPACT_PILL_INSET_V = COMPACT_ENVELOPE_INSET_V + Sizes.SEGMENT_TRACK_INSET

export const indicatorWidth = (width: number): ViewStyle => ({
  width
})

export default StyleSheet.create({
  // The press envelope, not a drawn surface: it is one option box tall and gives both of its insets
  // back as a negative margin, so it occupies the drawn track's height in layout while each option
  // inside it is a full-height target that nothing clips.
  envelope: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: Sizes.SEGMENT_TRACK_INSET
  },
  envelopeLarge: {
    alignSelf: 'stretch',
    minHeight: LARGE_OPTION_BOX_H,
    marginVertical: -LARGE_ENVELOPE_INSET_V
  },
  envelopeCompact: {
    alignSelf: 'flex-start',
    minHeight: COMPACT_OPTION_BOX_H,
    marginVertical: -COMPACT_ENVELOPE_INSET_V
  },
  trackSurface: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.tile,
    borderRadius: BorderRadius.PILL
  },
  trackSurfaceLarge: {
    top: LARGE_ENVELOPE_INSET_V,
    bottom: LARGE_ENVELOPE_INSET_V
  },
  trackSurfaceCompact: {
    top: COMPACT_ENVELOPE_INSET_V,
    bottom: COMPACT_ENVELOPE_INSET_V
  },
  indicator: {
    position: 'absolute',
    top: LARGE_PILL_INSET_V,
    bottom: LARGE_PILL_INSET_V,
    left: Sizes.SEGMENT_TRACK_INSET,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.card
  },
  option: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: LARGE_PILL_INSET_V
  },
  optionCompact: {
    flex: 0,
    paddingVertical: COMPACT_PILL_INSET_V
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
