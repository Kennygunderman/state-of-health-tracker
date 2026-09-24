import {StyleSheet, ViewStyle} from 'react-native'

import type {MetricGridItem} from '../index'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// The grid has no pure derivation of its own: it lays four equal flex columns out and lets Yoga size
// them, which is the AAP's universal responsive rule (0.7.5 — a fixed Figma width inside the content
// column becomes `flex: 1`). So the layout contract under test is the exported style objects the
// component renders, and the reference widths below are read out of those styles rather than out of a
// second formula that no screen evaluates.
const container = StyleSheet.flatten<ViewStyle>(styles.container)
const cell = StyleSheet.flatten<ViewStyle>(styles.cell)

const REFERENCE_DEVICE_WIDTH = 393
const SMALL_DEVICE_WIDTH = 375
const FIGMA_CELL_WIDTH_393 = 71.25
const FIGMA_CELL_WIDTH_375 = 66.75

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a
// percentage string — has to fail the test loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const columnGap = resolvedNumber(container.columnGap, "the grid's column gap")

// The grid's Props fix it at four items, so the column count is that tuple's arity. Typed against the
// component's own exported item type, so widening or narrowing the tuple fails the type-check here.
const REFERENCE_ITEMS: readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] = [
  {caption: 'CALORIES', value: '520'},
  {caption: 'PROTEIN', value: '32g'},
  {caption: 'CARBS', value: '48g'},
  {caption: 'FAT', value: '21g'}
]
const COLUMNS = REFERENCE_ITEMS.length

// The grid sits in RecipeDetail's nutrition card: `ContentColumn` takes a gutter off each edge of the
// device and the card takes its own padding off that, leaving 321 at the 393 px reference frame and
// 303 on a 375 px device.
const cardContentWidth = (deviceWidth: number): number => deviceWidth - (Spacing.GUTTER + Spacing.MEDIUM) * 2

// How Yoga resolves this row, not a parallel formula for it: `flex: 1` on every cell is a flex basis
// of 0 plus an equal share of whatever the interior gaps leave, and a child's main size is clamped at
// 0 however narrow the container becomes. The gap comes from the container style above.
const flexCellWidth = (containerWidth: number): number =>
  Math.max(containerWidth - columnGap * (COLUMNS - 1), 0) / COLUMNS

describe('the metric grid row', () => {
  it('lays its cells out as one row stretched across its parent', () => {
    expect(container.flexDirection).toBe('row')
    expect(container.alignSelf).toBe('stretch')
  })

  it('separates the columns by the small spacing token, and only between them', () => {
    expect(columnGap).toBe(Spacing.SMALL)
    expect(container.gap).toBeUndefined()
    expect(container.rowGap).toBeUndefined()
  })

  it('gives every column an equal share of the row', () => {
    expect(cell.flex).toBe(1)
    expect(cell.flexGrow).toBeUndefined()
    expect(cell.flexShrink).toBeUndefined()
  })

  it('carries no fixed Figma width, so the columns follow the container on every device', () => {
    expect(cell.width).toBeUndefined()
    expect(cell.minWidth).toBeUndefined()
    expect(cell.maxWidth).toBeUndefined()
    expect(cell.flexBasis).toBeUndefined()
  })

  it('stacks each caption over its value by the extra-extra-small spacing token', () => {
    expect(cell.rowGap).toBe(Spacing.XX_SMALL)
  })
})

describe('the widths that row resolves to', () => {
  it('is the 71.25 px Figma cell across the 321 px card content of the 393 px reference frame', () => {
    expect(cardContentWidth(REFERENCE_DEVICE_WIDTH)).toBe(321)
    expect(flexCellWidth(cardContentWidth(REFERENCE_DEVICE_WIDTH))).toBe(FIGMA_CELL_WIDTH_393)
  })

  it('narrows to 66.75 px across the 303 px card content of a 375 px device', () => {
    expect(cardContentWidth(SMALL_DEVICE_WIDTH)).toBe(303)
    expect(flexCellWidth(cardContentWidth(SMALL_DEVICE_WIDTH))).toBe(FIGMA_CELL_WIDTH_375)
  })

  it('fills each card exactly with its four cells and the three gaps between them', () => {
    ;[REFERENCE_DEVICE_WIDTH, SMALL_DEVICE_WIDTH].forEach(deviceWidth => {
      const cardContent = cardContentWidth(deviceWidth)

      expect(flexCellWidth(cardContent) * COLUMNS + columnGap * (COLUMNS - 1)).toBe(cardContent)
    })
  })

  it('charges one fewer gap than there are columns', () => {
    const cardContent = cardContentWidth(REFERENCE_DEVICE_WIDTH)
    const oneGapPerColumn = (cardContent - columnGap * COLUMNS) / COLUMNS

    expect(flexCellWidth(cardContent)).not.toBe(oneGapPerColumn)
    expect(flexCellWidth(cardContent)).toBe(FIGMA_CELL_WIDTH_393)
  })

  it('collapses to zero rather than a negative width in a container too narrow for its gaps', () => {
    expect(flexCellWidth(0)).toBe(0)
    expect(flexCellWidth(columnGap)).toBe(0)
    expect(flexCellWidth(0)).toBeGreaterThanOrEqual(0)
  })
})
