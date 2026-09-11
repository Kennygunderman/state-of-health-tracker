import {SKELETON_ALTERNATIVE_ROWS, skeletonBarWidth} from '../index.util'

// The text column the bars fill: 321px card interior less the 40px tile and the 12px gap at the 393px
// reference, and the same subtraction on a 375px device
const REFERENCE_TEXT_COLUMN = 269

const NARROW_TEXT_COLUMN = 251

const FIGMA_BAR_WIDTHS = [193.68, 129.12, 156.02, 107.59, 177.54, 139.88]

const proportionsInRowOrder = () => SKELETON_ALTERNATIVE_ROWS.flatMap(row => [row.primary, row.secondary])

describe('SKELETON_ALTERNATIVE_ROWS', () => {
  it('describes the three placeholder rows frame 13c draws', () => {
    expect(SKELETON_ALTERNATIVE_ROWS).toHaveLength(3)
  })

  it('reproduces every Figma bar width when applied to the 269px reference column', () => {
    const widths = proportionsInRowOrder().map(proportion => proportion * REFERENCE_TEXT_COLUMN)

    widths.forEach((width, index) => expect(width).toBeCloseTo(FIGMA_BAR_WIDTHS[index], 1))
  })

  it('keeps every proportion a fraction of the column', () => {
    proportionsInRowOrder().forEach(proportion => {
      expect(proportion).toBeGreaterThan(0)
      expect(proportion).toBeLessThan(1)
    })
  })

  it('keeps the primary bar wider than the secondary bar in every row', () => {
    SKELETON_ALTERNATIVE_ROWS.forEach(row => expect(row.primary).toBeGreaterThan(row.secondary))
  })
})

describe('skeletonBarWidth', () => {
  it('applies each proportion to the measured 393px-reference column', () => {
    const widths = proportionsInRowOrder().map(proportion => skeletonBarWidth(REFERENCE_TEXT_COLUMN, proportion))

    expect(widths).toEqual([194, 129, 156, 108, 178, 140])
  })

  it('scales down with the measured column on a 375px device', () => {
    const widths = proportionsInRowOrder().map(proportion => skeletonBarWidth(NARROW_TEXT_COLUMN, proportion))

    expect(widths).toEqual([181, 120, 146, 100, 166, 131])
  })

  it('never exceeds the column it is measured against', () => {
    proportionsInRowOrder().forEach(proportion =>
      expect(skeletonBarWidth(NARROW_TEXT_COLUMN, proportion)).toBeLessThan(NARROW_TEXT_COLUMN)
    )
  })

  it('returns no width before the column has been measured', () => {
    expect(skeletonBarWidth(0, SKELETON_ALTERNATIVE_ROWS[0].primary)).toBe(0)
    expect(skeletonBarWidth(-1, SKELETON_ALTERNATIVE_ROWS[0].primary)).toBe(0)
  })
})
