import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import styles from '../index.styled'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so values are read through `flatten`, exactly as the renderer resolves them.
const container: ViewStyle = StyleSheet.flatten(styles.container)
const label: TextStyle = StyleSheet.flatten(styles.label)
const value: TextStyle = StyleSheet.flatten(styles.value)

const PERCENTAGE_PATTERN = /^(\d+(?:\.\d+)?)%$/

// The two columns are only safe from each other if the capped one can never claim the whole row. Reading
// the cap back as a number lets the complement -- the share the flexing column is guaranteed -- be
// asserted as a property of the stylesheet rather than restated as a literal.
const cappedSharePercent = (raw: unknown, description: string): number => {
  if (typeof raw !== 'string') {
    throw new Error(`Expected ${description} to be a percentage string, received ${String(raw)}`)
  }

  const match = PERCENTAGE_PATTERN.exec(raw)

  if (!match) {
    throw new Error(`Expected ${description} to be a percentage string, received "${raw}"`)
  }

  return Number(match[1])
}

describe('MacroLegendRow value column', () => {
  it('can shrink, so a long value cannot push the row past the card it sits in', () => {
    expect(value.flexShrink).toBe(1)
  })

  it('is capped, leaving the flexing label a guaranteed share of the row', () => {
    const share = cappedSharePercent(value.maxWidth, 'the value cap')

    expect(share).toBeLessThanOrEqual(50)
    expect(100 - share).toBeGreaterThanOrEqual(50)
  })

  it('keeps the right alignment that carries a value wrapped onto a second line', () => {
    expect(value.textAlign).toBe('right')
  })

  it('keeps the Figma-drawn type and colour of nodes 34:61 and 49:120', () => {
    expect(value.fontSize).toBe(FontSize.BODY)
    expect(value.fontWeight).toBe(FontWeight.SEMIBOLD)
    expect(value.color).toBe(Theme.colors.text)
  })
})

describe('MacroLegendRow label column', () => {
  it('flexes and is uncapped, so all remaining width becomes label lines rather than a truncation', () => {
    expect(label.flex).toBe(1)
    expect(label.maxWidth).toBeUndefined()
  })

  it('keeps the Figma-drawn type and colour', () => {
    expect(label.fontSize).toBe(FontSize.BODY)
    expect(label.fontWeight).toBe(FontWeight.REGULAR)
    expect(label.color).toBe(Theme.colors.textSecondary)
  })
})

describe('MacroLegendRow container', () => {
  // Deliberately centred where the sibling ingredient row is top-aligned: this row leads with an 8px dot,
  // which reads as a bullet against the label's first line only while the cross-axis stays centred.
  it('stays centred so the macro dot aligns with the label', () => {
    expect(container.alignItems).toBe('center')
  })

  it('keeps the drawn 8px gap and 8px vertical padding', () => {
    expect(container.columnGap).toBe(Spacing.X_SMALL)
    expect(container.paddingVertical).toBe(Spacing.X_SMALL)
  })
})
