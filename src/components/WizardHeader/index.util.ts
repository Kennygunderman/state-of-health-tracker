export const filledSegmentCount = (step: number, total: number): number =>
  Math.min(Math.max(step, 0), Math.max(total, 0))
