import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Theme} from '@styles/theme'

import styles from '../index.styled'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so values are read through `flatten`, exactly as the renderer resolves them.
const container: ViewStyle = StyleSheet.flatten(styles.container)
const name: TextStyle = StyleSheet.flatten(styles.name)
const quantity: TextStyle = StyleSheet.flatten(styles.quantity)

const PERCENTAGE_PATTERN = /^(\d+(?:\.\d+)?)%$/

// The two columns are only safe from each other if the capped one can never claim the whole row. Reading
// the cap back as a number lets the complement -- the share the flexing column is guaranteed -- be
// asserted as a property of the stylesheet rather than restated as a literal.
const cappedSharePercent = (value: unknown, description: string): number => {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${description} to be a percentage string, received ${String(value)}`)
  }

  const match = PERCENTAGE_PATTERN.exec(value)

  if (!match) {
    throw new Error(`Expected ${description} to be a percentage string, received "${value}"`)
  }

  return Number(match[1])
}

describe('cappedSharePercent', () => {
  it('reads a percentage cap back as a number', () => {
    expect(cappedSharePercent('50%', 'a cap')).toBe(50)
  })

  it('rejects a cap it cannot reason about instead of scoring it', () => {
    expect(() => cappedSharePercent(120, 'a pixel cap')).toThrow('to be a percentage string')
    expect(() => cappedSharePercent('auto', 'a keyword cap')).toThrow('to be a percentage string')
  })
})

describe('IngredientRow quantity column', () => {
  it('can shrink, so a long quantity cannot push the row past the card it sits in', () => {
    expect(quantity.flexShrink).toBe(1)
  })

  it('is capped, leaving the flexing name a guaranteed share of the row', () => {
    const share = cappedSharePercent(quantity.maxWidth, 'the quantity cap')

    expect(share).toBeLessThanOrEqual(50)
    expect(100 - share).toBeGreaterThanOrEqual(50)
  })

  it('keeps the Figma-drawn type and colour of node 49:616 while wrapping within that cap', () => {
    expect(quantity.fontSize).toBe(FontSize.BODY)
    expect(quantity.fontWeight).toBe(FontWeight.REGULAR)
    expect(quantity.textAlign).toBe('right')
    expect(quantity.color).toBe(Theme.colors.textSecondary)
  })
})

describe('IngredientRow name column', () => {
  it('flexes, so all remaining width becomes name lines rather than a truncation', () => {
    expect(name.flex).toBe(1)
    expect(name.maxWidth).toBeUndefined()
  })

  it('keeps the Figma-drawn type and colour', () => {
    expect(name.fontSize).toBe(FontSize.BODY)
    expect(name.fontWeight).toBe(FontWeight.REGULAR)
    expect(name.color).toBe(Theme.colors.text)
  })
})

describe('IngredientRow container', () => {
  // Figma node 49:616 authors `alignItems: center` explicitly and declares no gap of any kind, while the
  // instruction step row beside it authors exactly the opposite pair. Both halves are pinned here so that
  // the neighbour's model is not copied onto this row again.
  it('centres the columns on the cross axis, as the design authors', () => {
    expect(container.alignItems).toBe('center')
  })

  it('declares no gap, leaving space-between as the only separation between the columns', () => {
    expect(container.gap).toBeUndefined()
    expect(container.columnGap).toBeUndefined()
  })

  it('stretches and stays hug-height, carrying no surface of its own', () => {
    expect(container.flexDirection).toBe('row')
    expect(container.alignSelf).toBe('stretch')
    expect(container.justifyContent).toBe('space-between')
    expect(container.height).toBeUndefined()
    expect(container.backgroundColor).toBeUndefined()
  })
})
