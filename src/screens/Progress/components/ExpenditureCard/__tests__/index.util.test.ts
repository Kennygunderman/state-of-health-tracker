import {buildExpenditureTrend, formatKcal} from '../index.util'

describe('buildExpenditureTrend', () => {
  it('maps expenditure points to chart points', () => {
    const trend = buildExpenditureTrend([
      {day: '2026-07-01', tdeeKcal: 2750, trendWeightKg: 88.2},
      {day: '2026-07-02', tdeeKcal: 2760, trendWeightKg: null}
    ])

    expect(trend).toEqual([
      {date: '2026-07-01', value: 2750},
      {date: '2026-07-02', value: 2760}
    ])
  })

  it('returns an empty array for an empty series', () => {
    expect(buildExpenditureTrend([])).toEqual([])
  })
})

describe('formatKcal', () => {
  it('formats with a thousands separator', () => {
    expect(formatKcal(2791)).toBe('2,791')
  })

  it('rounds fractional values', () => {
    expect(formatKcal(2790.6)).toBe('2,791')
  })
})
