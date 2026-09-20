import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {LineHeight} from '@styles/fontSize'

import styles from '../index.styled'

// The figure is what sets this row's height, and the row is what sets the height of every card it sits in
// (13b day totals, the 09 targets card, the planned-totals card), so the box under test here decides where
// the progress bar, the hairline and the legend rows below it land. The reference numbers are the reconciled
// Figma specification: node 36:199 (the "1,835" totals figure) declares its own dimensions as 74 x 34 and
// carries no line height, while the 28 px title beside it (36:146) explicitly declares 32.2.
const FIGMA_FIGURE_BOX = 34
const FIGMA_TITLE_BOX = 32.2
const FIGMA_UNIT_BOX = 18.85

// React Native's fallback when a line height is unset: the font's own multiplier, which reproduces none of
// the boxes Figma resolves. Named here because it is the third value this style could have carried and the
// only one nothing in the file draws.
const PLATFORM_LINE_HEIGHT_MULTIPLIER = 1.21

// Guarded rather than cast, and read inside the tests rather than at module scope: a style value that stops
// being a number — dropped, or authored as a percentage string — has to fail the assertion that states what
// it is for instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// Mirrors the array the component composes for its figure: the shared weight and colour, then the size
// variant the caller selects.
const figureStyle = (size: 'hero' | 'stat'): TextStyle =>
  StyleSheet.flatten<TextStyle>([styles.figure, size === 'hero' ? styles.figureHero : styles.figureStat])

const figureBox = (): number => resolvedNumber(figureStyle('stat').lineHeight, "the 28 px stat figure's line box")

const unitBox = (): number =>
  resolvedNumber(StyleSheet.flatten<TextStyle>(styles.unit).lineHeight, "the unit label's line box")

describe('the 28 px stat figure (36:199)', () => {
  it('resolves to the 34 px box Figma declares for the figure', () => {
    expect(figureBox()).toBe(FIGMA_FIGURE_BOX)
    expect(figureBox()).toBe(LineHeight.STAT_LG_FIGURE)
    expect(resolvedNumber(figureStyle('stat').fontSize, "the stat figure's size")).toBe(FontSize.STAT_LG)
  })

  it('does not reuse the 32.2 px box the 28 px title beside it authors', () => {
    expect(figureBox()).not.toBe(FIGMA_TITLE_BOX)
    expect(figureBox()).not.toBe(LineHeight.STAT_LG)
    expect(figureBox() - FIGMA_TITLE_BOX).toBeCloseTo(1.8, 5)
  })

  it('does not leave the box to the platform font multiplier either', () => {
    const platformBox = FontSize.STAT_LG * PLATFORM_LINE_HEIGHT_MULTIPLIER

    expect(platformBox).toBeCloseTo(33.88, 5)
    expect(figureBox()).not.toBeCloseTo(platformBox, 5)
  })

  it('leaves the 32.2 px title box in the map untouched, for the titles that do declare it', () => {
    expect(LineHeight.STAT_LG).toBe(FIGMA_TITLE_BOX)
  })

  it('sets the row height from the figure rather than from the unit beside it', () => {
    expect(unitBox()).toBe(FIGMA_UNIT_BOX)
    expect(Math.max(figureBox(), unitBox())).toBe(FIGMA_FIGURE_BOX)
  })
})

describe('the row that draws the figure and its unit', () => {
  it('keeps them on one baseline-aligned row rather than the frame absolute offsets', () => {
    const row = StyleSheet.flatten<ViewStyle>(styles.row)

    expect(row.flexDirection).toBe('row')
    expect(row.alignItems).toBe('baseline')
    expect(row.position).toBeUndefined()
    expect(row.top).toBeUndefined()
    expect(row.left).toBeUndefined()
  })

  it('leaves the 44 px hero figure exactly as it was, since no measurement covers it', () => {
    const hero = figureStyle('hero')

    expect(resolvedNumber(hero.fontSize, "the hero figure's size")).toBe(FontSize.STAT_HERO)
    expect(hero.lineHeight).toBeUndefined()
  })
})
