export const metricCellWidth = (containerWidth: number, gap: number, columns: number): number =>
  containerWidth <= 0 || columns <= 0 ? 0 : (containerWidth - gap * (columns - 1)) / columns
