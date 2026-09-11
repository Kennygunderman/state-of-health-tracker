/**
 * An n-segment row has n - 1 gaps between segments, not n; an unmeasured or empty track yields 0.
 */
export const progressSegmentWidth = (trackWidth: number, total: number, gap: number): number => {
  if (trackWidth <= 0 || total <= 0) return 0

  const interiorGaps = total - 1

  return (trackWidth - gap * interiorGaps) / total
}

export const filledSegmentCount = (step: number, total: number): number =>
  Math.min(Math.max(step, 0), Math.max(total, 0))
