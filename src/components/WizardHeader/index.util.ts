/** An n-segment row has n - 1 gaps between segments, not n; returns 0 for an unmeasured or empty track. */
export const progressSegmentWidth = (trackWidth: number, total: number, gap: number): number => {
  if (trackWidth <= 0 || total <= 0) return 0

  return (trackWidth - gap * (total - 1)) / total
}

export const filledSegmentCount = (step: number, total: number): number =>
  Math.min(Math.max(step, 0), Math.max(total, 0))
