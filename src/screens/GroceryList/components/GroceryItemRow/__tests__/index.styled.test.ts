import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import styles from '../index.styled'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so values are read through `flatten`, exactly as the renderer resolves the
// component's `[base, variant]` arrays.
const row: ViewStyle = StyleSheet.flatten(styles.row)
const checkbox: ViewStyle = StyleSheet.flatten(styles.checkbox)
const name: TextStyle = StyleSheet.flatten(styles.name)
const quantity: TextStyle = StyleSheet.flatten(styles.quantity)
const mutedName: TextStyle = StyleSheet.flatten([styles.name, styles.nameMuted])
const mutedQuantity: TextStyle = StyleSheet.flatten([styles.quantity, styles.quantityMuted])

const PERCENTAGE_PATTERN = /^(\d+(?:\.\d+)?)%$/

// The two text columns are only safe from each other if the capped one can never claim the whole row.
// Reading the cap back as a number lets the complement -- the share the flexing column is guaranteed --
// be asserted as a property of the stylesheet rather than restated as a literal.
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

describe('GroceryItemRow quantity column', () => {
  it('can shrink, so a long aggregated amount cannot push the row past its card', () => {
    expect(quantity.flexShrink).toBe(1)
  })

  it('is capped, leaving the flexing name a guaranteed share of the row', () => {
    const share = cappedSharePercent(quantity.maxWidth, 'the quantity cap')

    expect(share).toBeLessThanOrEqual(50)
    expect(100 - share).toBeGreaterThanOrEqual(50)
  })

  it('keeps the Figma-drawn type and colour of node 37:54 while wrapping within that cap', () => {
    expect(quantity.fontSize).toBe(FontSize.BODY)
    expect(quantity.fontWeight).toBe(FontWeight.REGULAR)
    expect(quantity.textAlign).toBe('right')
    expect(quantity.color).toBe(Theme.colors.textSecondary)
  })
})

describe('GroceryItemRow name column', () => {
  it('flexes and is uncapped, so a long name becomes extra lines and never moves the amount', () => {
    expect(name.flex).toBe(1)
    expect(name.maxWidth).toBeUndefined()
  })

  it('keeps the Figma-drawn type and colour', () => {
    expect(name.fontSize).toBe(FontSize.BODY)
    expect(name.fontWeight).toBe(FontWeight.REGULAR)
    expect(name.color).toBe(Theme.colors.text)
  })
})

describe('GroceryItemRow checked-muted variant', () => {
  // The muted variant is the one the inferred checked-decrease row renders, so the cap and the shrink have
  // to survive the variant merge: a decrease updates the amount text and must not re-open the layout.
  it('carries the shrink and the cap through the variant merge', () => {
    expect(mutedQuantity.flexShrink).toBe(1)
    expect(cappedSharePercent(mutedQuantity.maxWidth, 'the muted quantity cap')).toBeLessThanOrEqual(50)
  })

  it('keeps the two-tone mute of node 37:276 unchanged', () => {
    expect(mutedName.textDecorationLine).toBe('line-through')
    expect(mutedName.color).toBe(Theme.colors.textFaint)
    expect(mutedQuantity.color).toBe(Theme.colors.textDisabled)
  })
})

describe('GroceryItemRow checkbox and row shell', () => {
  it('holds the checkbox at its full width, so shrink pressure never reaches the control', () => {
    expect(checkbox.flexShrink).toBe(0)
  })

  it('keeps the drawn 12px gap and 12px vertical padding that make the row 46px tall', () => {
    expect(row.columnGap).toBe(Spacing.SMALL)
    expect(row.paddingVertical).toBe(Spacing.SMALL)
    expect(row.height).toBeUndefined()
  })

  it('centres the columns and carries no surface of its own, the card supplying the fill', () => {
    expect(row.alignItems).toBe('center')
    expect(row.alignSelf).toBe('stretch')
    expect(row.backgroundColor).toBeUndefined()
  })
})
