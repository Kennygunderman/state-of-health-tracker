import {CHIP_PILL_WIDTHS} from '../index.styled'
import {chipPlaceholders} from '../index.util'

// The ten chips this cloud holds: None and the nine named allergies the saved step accepts.
const ALLERGEN_CHIP_COUNT = 10

describe('chipPlaceholders', () => {
  it('stands one placeholder in for every chip the loaded cloud will hold', () => {
    expect(chipPlaceholders(ALLERGEN_CHIP_COUNT)).toHaveLength(ALLERGEN_CHIP_COUNT)
  })

  it('yields nothing for a cloud with no chips, which has nothing to stand in for', () => {
    expect(chipPlaceholders(0)).toEqual([])
  })

  it('yields nothing rather than throwing for a count below zero', () => {
    expect(chipPlaceholders(-1)).toEqual([])
  })

  it('cycles the widths, so the cloud wraps like an answer rather than like identical blocks', () => {
    const widths = chipPlaceholders(CHIP_PILL_WIDTHS.length + 1).map(placeholder => placeholder.width)

    expect(widths.slice(0, CHIP_PILL_WIDTHS.length)).toEqual([...CHIP_PILL_WIDTHS])
    expect(widths[CHIP_PILL_WIDTHS.length]).toBe(CHIP_PILL_WIDTHS[0])
  })

  it('draws every width from the declared set, so no placeholder is sized by arithmetic', () => {
    chipPlaceholders(ALLERGEN_CHIP_COUNT).forEach(placeholder => {
      expect(CHIP_PILL_WIDTHS).toContain(placeholder.width)
    })
  })

  it('names every placeholder distinctly, so no two share a key', () => {
    const keys = chipPlaceholders(ALLERGEN_CHIP_COUNT).map(placeholder => placeholder.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns an equal result for repeated calls, and a fresh array the caller may keep', () => {
    const first = chipPlaceholders(ALLERGEN_CHIP_COUNT)
    const second = chipPlaceholders(ALLERGEN_CHIP_COUNT)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})
