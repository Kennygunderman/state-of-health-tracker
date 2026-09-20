import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'

import styles from '../index.styled'

// The "n of m" counter is the wizard chrome every step of the flow renders, and it hugs: it has no wrapper of
// its own and no padding, so its line box alone decides how tall it draws and where the centred row puts it.
// The finding was that the box was left unset while every sibling 13px style in the flow pins one.
const header = StyleSheet.flatten<ViewStyle>(styles.header)
const counter = StyleSheet.flatten<TextStyle>(styles.counter)

// Guarded rather than cast, and read inside the tests: a value that stops being a number — dropped, or
// authored as a percentage string — has to fail the assertion that states what it is for, rather than be
// scored as `undefined` or crash the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const counterBox = (): number => resolvedNumber(counter.lineHeight, "the step counter's line box")

// The box Figma resolves for the counter nodes (46:289 "2 of 7", 46:165 "1 of 7", 47:145), none of which
// declares a line height, and the disc that sets the header row's height.
const FIGMA_COUNTER_BOX = 16
const HEADER_ROW_HEIGHT = Sizes.TILE_SM

// What the platform font would invent from 13 x 1.21 if the box were left unset — the value the counter
// resolved to before this fix — and the authored multi-line meta box, which no 13px node in the flow's
// chrome declares.
const PLATFORM_BOX = 15.73
const AUTHORED_MULTILINE_BOX = 18.85

describe('the step counter line box', () => {
  it('is the 16 Figma resolves for the counter nodes rather than the platform font metric', () => {
    expect(counterBox()).toBe(LineHeight.LABEL)
    expect(counterBox()).toBe(FIGMA_COUNTER_BOX)
    expect(counterBox()).not.toBeCloseTo(PLATFORM_BOX, 2)
  })

  it('is pinned at all, so the chrome of every wizard step draws at one height on both platforms', () => {
    expect(counter.lineHeight).toBeDefined()
  })

  it('is not the authored multi-line box, which would draw this single line 2.85 too tall', () => {
    expect(counterBox()).not.toBe(LineHeight.META)
    expect(counterBox()).not.toBeCloseTo(AUTHORED_MULTILINE_BOX, 2)
  })

  it('carries the label size and weight the counter is drawn at', () => {
    expect(counter.fontSize).toBe(FontSize.LABEL)
    expect(counter.fontWeight).toBe(FontWeight.SEMIBOLD)
  })
})

describe('how that box sits in the header row', () => {
  it('hugs with no padding of its own, so the box is the whole of the counter block', () => {
    expect(counter.padding).toBeUndefined()
    expect(counter.paddingTop).toBeUndefined()
    expect(counter.paddingVertical).toBeUndefined()
    expect(counter.height).toBeUndefined()
  })

  // The row is centred and taller than the counter, so a 16 box centres exactly where the comp draws it,
  // while the 15.73 the platform font resolves would seat it a quarter-pixel high.
  it('centres inside the 40 px row the back disc sets, with room to spare', () => {
    expect(header.flexDirection).toBe('row')
    expect(header.alignItems).toBe('center')
    expect(counterBox()).toBeLessThan(HEADER_ROW_HEIGHT)
  })
})
