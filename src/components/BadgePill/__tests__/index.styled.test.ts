import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Theme} from '@styles/theme'

import styles from '../index.styled'

// Both BadgePill tones put a 13px/600 label on a filled pill. That type is not WCAG "large text" (which
// starts at 18.66px/700 or 24px), so the applicable AA minimum for every tone here is 4.5:1 rather than
// 3:1. The pills are pinned against that number below so a later re-tint of either tone — or of the
// `Theme` colours they read — cannot drop the rendered pairing under AA unnoticed.
const MINIMUM_CONTRAST_RATIO = 4.5

const OPAQUE_HEX_PATTERN = /^#([0-9a-f]{6})$/i

// WCAG 2.1 relative luminance and contrast ratio. Deliberately test-local: nothing in `src/` computes
// contrast at runtime, so this stays a property of the test rather than becoming a shared helper.
const srgbChannels = (color: string): number[] => {
  const match = OPAQUE_HEX_PATTERN.exec(color)

  if (!match) {
    throw new Error(`Expected an opaque 6-digit hex colour, received "${color}"`)
  }

  const hex = match[1]

  return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
}

const relativeLuminance = (color: string): number => {
  const [red, green, blue] = srgbChannels(color).map(channel =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left
  )

  return (lighter + 0.05) / (darker + 0.05)
}

// Guarded rather than cast: a token that stops being an opaque colour string has to fail the test loudly
// instead of being scored as `undefined`.
const resolvedColor = (value: unknown, description: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${description} to resolve to a colour string, received ${String(value)}`)
  }

  return value
}

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so the rendered values are read through `flatten`, exactly as the renderer resolves the
// component's `[base, variant]` arrays.
const neutralPill: ViewStyle = StyleSheet.flatten(styles.pill)
const neutralLabel: TextStyle = StyleSheet.flatten(styles.label)
const warningPill: ViewStyle = StyleSheet.flatten([styles.pill, styles.pillWarning])
const warningLabel: TextStyle = StyleSheet.flatten([styles.label, styles.labelWarning])

describe('contrastRatio', () => {
  it('returns 21:1 for the maximum pairing', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
  })

  it('returns 1:1 for a colour on itself and is order-independent', () => {
    expect(contrastRatio(Theme.colors.dangerTint, Theme.colors.dangerTint)).toBeCloseTo(1, 5)
    expect(contrastRatio(Theme.colors.dangerTint, Theme.colors.text)).toBeCloseTo(
      contrastRatio(Theme.colors.text, Theme.colors.dangerTint),
      5
    )
  })

  it('rejects a colour it cannot composite instead of scoring it', () => {
    expect(() => contrastRatio(Theme.colors.dangerBorder, Theme.colors.dangerTint)).toThrow(
      'Expected an opaque 6-digit hex colour'
    )
  })
})

describe('BadgePill label type', () => {
  it('renders at 13px/600, the size and weight that make 4.5:1 the applicable AA minimum', () => {
    expect(neutralLabel.fontSize).toBe(FontSize.LABEL)
    expect(neutralLabel.fontWeight).toBe(FontWeight.SEMIBOLD)
    expect(warningLabel.fontSize).toBe(FontSize.LABEL)
    expect(warningLabel.fontWeight).toBe(FontWeight.SEMIBOLD)
  })
})

describe('BadgePill neutral tone', () => {
  it('renders the Figma-drawn treatment: the textSecondary label on the tile fill (49:551)', () => {
    expect(resolvedColor(neutralPill.backgroundColor, 'the neutral fill')).toBe(Theme.colors.tile)
    expect(resolvedColor(neutralLabel.color, 'the neutral label')).toBe(Theme.colors.textSecondary)
  })

  it('clears WCAG AA for its label on its own fill', () => {
    const ratio = contrastRatio(
      resolvedColor(neutralLabel.color, 'the neutral label'),
      resolvedColor(neutralPill.backgroundColor, 'the neutral fill')
    )

    expect(ratio).toBeGreaterThanOrEqual(MINIMUM_CONTRAST_RATIO)
  })
})

describe('BadgePill warning tone', () => {
  it('keeps the dangerTint fill the estimate badges are drawn on', () => {
    expect(resolvedColor(warningPill.backgroundColor, 'the warning fill')).toBe(Theme.colors.dangerTint)
  })

  it('clears WCAG AA for its label on that fill', () => {
    const ratio = contrastRatio(
      resolvedColor(warningLabel.color, 'the warning label'),
      resolvedColor(warningPill.backgroundColor, 'the warning fill')
    )

    expect(ratio).toBeGreaterThanOrEqual(MINIMUM_CONTRAST_RATIO)
  })

  it('does not reuse the danger label of the Figma-drawn delta pill, which misses AA on this fill', () => {
    expect(contrastRatio(Theme.colors.danger, Theme.colors.dangerTint)).toBeLessThan(MINIMUM_CONTRAST_RATIO)
    expect(resolvedColor(warningLabel.color, 'the warning label')).not.toBe(Theme.colors.danger)
  })
})
