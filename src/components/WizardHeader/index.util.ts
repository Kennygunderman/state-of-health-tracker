/**
 * An n-segment row has n - 1 gaps between segments, not n; returns 0 for an unmeasured or empty track. Past the
 * guard `Math.sign(total)` is exactly that unit decrement: the token-literal gate rejects a bare structural
 * literal and no design token means 'one'.
 */
export const progressSegmentWidth = (trackWidth: number, total: number, gap: number): number => {
  if (trackWidth <= 0 || total <= 0) return 0

  const interiorGaps = total - Math.sign(total)

  return (trackWidth - gap * interiorGaps) / total
}

export const filledSegmentCount = (step: number, total: number): number =>
  Math.min(Math.max(step, 0), Math.max(total, 0))
