import {metricCellWidth} from '../index.util'

describe('metricCellWidth', () => {
  it('returns 0 when the container width is zero or negative', () => {
    expect(metricCellWidth(0, 12, 4)).toBe(0)
    expect(metricCellWidth(-100, 12, 4)).toBe(0)
  })

  it('returns 0 when the column count is zero or negative', () => {
    expect(metricCellWidth(321, 12, 0)).toBe(0)
    expect(metricCellWidth(321, 12, -2)).toBe(0)
  })

  it('returns the 71.25px Figma cell for the 321px card content at the 393px reference', () => {
    expect(metricCellWidth(321, 12, 4)).toBe(71.25)
  })

  it('returns a 66.75px cell for the 303px card content on a 375px device', () => {
    expect(metricCellWidth(303, 12, 4)).toBe(66.75)
  })

  it('gives a single column the whole container because it spans no gaps', () => {
    expect(metricCellWidth(321, 12, 1)).toBe(321)
  })
})
