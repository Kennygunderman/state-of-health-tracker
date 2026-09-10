import {
  buildDonutSegments,
  buildMacroBreakdown,
  dominantMacroKey,
  formatDetailSubtitle,
  formatMacroSummary
} from '../index.util'

describe('buildMacroBreakdown', () => {
  it('computes calorie shares with 4/4/9 weighting', () => {
    const [protein, carbs, fat] = buildMacroBreakdown(1, 50, 3)

    expect(protein.percent).toBe(2)
    expect(carbs.percent).toBe(87)
    expect(fat.percent).toBe(12)
    expect(protein.grams).toBe(1)
    expect(protein.calorieShare + carbs.calorieShare + fat.calorieShare).toBeCloseTo(1)
  })

  it('returns zero shares when all macros are zero', () => {
    const slices = buildMacroBreakdown(0, 0, 0)

    expect(slices.every(slice => slice.calorieShare === 0 && slice.percent === 0)).toBe(true)
  })
})

describe('dominantMacroKey', () => {
  it('picks the macro contributing the most calories', () => {
    expect(dominantMacroKey(buildMacroBreakdown(1, 50, 3))).toBe('carbs')
    expect(dominantMacroKey(buildMacroBreakdown(35, 0, 4))).toBe('protein')
    expect(dominantMacroKey(buildMacroBreakdown(0, 0, 10))).toBe('fat')
  })
})

describe('buildDonutSegments', () => {
  it('drops zero slices and fills the ring minus gaps', () => {
    const segments = buildDonutSegments(buildMacroBreakdown(10, 0, 10), 0.02)

    expect(segments.map(s => s.key)).toEqual(['protein', 'fat'])

    const totalLength = segments.reduce((sum, s) => sum + s.lengthFraction, 0)

    expect(totalLength).toBeCloseTo(1 - 0.02 * 2)
  })

  it('offsets each segment past the previous one plus a gap', () => {
    const [first, second] = buildDonutSegments(buildMacroBreakdown(10, 10, 0), 0.02)

    expect(first.startFraction).toBe(0)
    expect(second.startFraction).toBeCloseTo(first.lengthFraction + 0.02)
  })

  it('uses no gap for a single visible slice', () => {
    const segments = buildDonutSegments(buildMacroBreakdown(0, 25, 0), 0.02)

    expect(segments).toHaveLength(1)
    expect(segments[0].lengthFraction).toBeCloseTo(1)
  })

  it('returns nothing when every macro is zero', () => {
    expect(buildDonutSegments(buildMacroBreakdown(0, 0, 0))).toEqual([])
  })
})

describe('formatMacroSummary', () => {
  it('formats rounded gram amounts', () => {
    expect(formatMacroSummary(1.5, 74.6, 4.5)).toBe('2g P · 75g C · 5g F')
    expect(formatMacroSummary(0, 24, 0)).toBe('0g P · 24g C · 0g F')
  })
})

describe('formatDetailSubtitle', () => {
  it('joins serving text and calories', () => {
    expect(formatDetailSubtitle(null, '1 cup', 231, 'cal per serving')).toBe('1 cup · 231 cal per serving')
  })

  it('leads with the brand when present', () => {
    expect(formatDetailSubtitle('Chobani', '1 cup', 231, 'cal per serving')).toBe(
      'Chobani · 1 cup · 231 cal per serving'
    )
  })

  it('omits the brand and serving text when missing', () => {
    expect(formatDetailSubtitle(null, null, 231, 'cal per serving')).toBe('231 cal per serving')
  })
})
