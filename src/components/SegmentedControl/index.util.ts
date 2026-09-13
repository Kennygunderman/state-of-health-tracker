import type {SegmentedControlVariant} from './index'

/**
 * The segments divide what the track's leading and trailing insets leave behind.
 * Returns 0 while the track is unmeasured (before onLayout) or has no segments to divide.
 */
export const segmentWidthFor = (trackWidth: number, optionCount: number, trackInset: number): number => {
  if (trackWidth <= 0 || optionCount <= 0) {
    return 0
  }

  return (trackWidth - trackInset - trackInset) / optionCount
}

/**
 * The drawn track surrounds its pill with the same inset above and below, so the control the design
 * draws is the pill plus both insets: 36 for the stretched large variant, 29 for a hugging one.
 */
export const visualTrackHeightFor = (segmentHeight: number, trackInset: number): number =>
  segmentHeight + trackInset + trackInset

/**
 * Hit slop cannot lift a segment to the minimum target here: React Native never extends a touch
 * past the parent's bounds, and the parent is the track the design fixes at 36 (or 29). So each
 * option is rendered inside a press envelope of the target height, and this is the inset from that
 * envelope to the drawn track. The envelope carries it back as a negative vertical margin, so the
 * envelope occupies exactly the track's height in layout and nothing moves on screen. A track that
 * already reaches the target, as it does once the label scales up, needs no envelope and no inset.
 */
export const segmentEnvelopeInsetFor = (visualTrackHeight: number, touchTarget: number): number => {
  const shortfall = touchTarget - visualTrackHeight

  if (!Number.isFinite(shortfall) || shortfall <= 0) {
    return 0
  }

  return shortfall / 2
}

/**
 * The option's own box, which is what the user presses: the drawn pill plus the envelope inset and
 * the track inset above and below it. It is a real view of this height inside an envelope of the
 * same height, so nothing clips it.
 */
export const optionBoxHeightFor = (segmentHeight: number, envelopeInset: number, trackInset: number): number => {
  const inset = envelopeInset + trackInset

  return segmentHeight + inset + inset
}

/**
 * What the envelope occupies in layout once its negative vertical margin gives both insets back —
 * which must equal the drawn track's height, at every text size, for the control to sit exactly
 * where it sat before it gained a press envelope.
 */
export const envelopeFootprintFor = (optionBoxHeight: number, envelopeInset: number): number =>
  optionBoxHeight - envelopeInset - envelopeInset

export const isFlexSegments = (variant: SegmentedControlVariant): boolean => variant === 'large'
