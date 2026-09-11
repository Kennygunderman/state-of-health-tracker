export interface SkeletonAlternativeRow {
  primary: number
  secondary: number
}

// Frame 13c sizes each placeholder bar as a fraction of its row's fill-width text column, so the card matches
// the design on every device rather than only at the 393px reference: Figma's 193.68/129.12, 156.02/107.59 and
// 177.54/139.88 over a 269px column (321px card interior less the 40px tile and the 12px gap), which is 251px
// on a 375px device. They live here rather than in index.styled.ts because they are layout ratios rather than
// design tokens, and a stylesheet may carry no numeric literal.
export const SKELETON_ALTERNATIVE_ROWS: ReadonlyArray<SkeletonAlternativeRow> = [
  {primary: 0.72, secondary: 0.48},
  {primary: 0.58, secondary: 0.4},
  {primary: 0.66, secondary: 0.52}
]

export function skeletonBarWidth(textColumnWidth: number, widthProportion: number): number {
  return textColumnWidth > 0 ? Math.round(textColumnWidth * widthProportion) : 0
}
