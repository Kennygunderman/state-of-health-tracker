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

export const isFlexSegments = (variant: SegmentedControlVariant): boolean => variant === 'large'
