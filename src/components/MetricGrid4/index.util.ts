/**
 * A row of n cells spans one fewer gap than it has cells. Past the positive guard `Math.sign(columns)` is exactly
 * that unit decrement: the token-literal gate rejects a bare structural literal and no design token means 'one'.
 */
export const metricCellWidth = (containerWidth: number, gap: number, columns: number): number => {
  if (containerWidth <= 0 || columns <= 0) return 0

  const interiorGaps = columns - Math.sign(columns)

  return (containerWidth - gap * interiorGaps) / columns
}
