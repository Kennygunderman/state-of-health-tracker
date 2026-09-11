export const metricCellWidth = (containerWidth: number, gap: number, columns: number): number => {
  if (containerWidth <= 0 || columns <= 0) return 0

  const interiorGaps = columns - 1

  return (containerWidth - gap * interiorGaps) / columns
}
