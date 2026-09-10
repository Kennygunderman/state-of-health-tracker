import type {SegmentedControlVariant} from './index'

/** Returns 0 while the track is unmeasured (before onLayout) or has no segments to divide. */
export const segmentWidthFor = (trackWidth: number, optionCount: number, trackInset: number): number => {
  if (trackWidth <= 0 || optionCount <= 0) {
    return 0
  }

  return (trackWidth - trackInset * 2) / optionCount
}

export const isFlexSegments = (variant: SegmentedControlVariant): boolean => variant === 'large'
