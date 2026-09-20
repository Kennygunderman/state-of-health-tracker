import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React Native
// version, so the headline is read through `flatten`, exactly as the renderer resolves it.
const headline = StyleSheet.flatten<TextStyle>(styles.headline)

// Guarded rather than cast, and read inside the tests rather than at module scope: an inset that stops being a
// number — dropped, or authored as a percentage string — has to fail the assertion that states what it is for
// instead of being scored as `undefined` or crashing the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const topInset = (): number => resolvedNumber(headline.paddingTop, "the headline block's top inset")

const lineBox = (): number => resolvedNumber(headline.lineHeight, "the headline's pinned line height")

const remainder = (): number =>
  resolvedNumber(headline.paddingBottom, "the headline block's bottom remainder, which closes it on a whole pixel")

const blockHeight = (): number => topInset() + lineBox() + remainder()

// Figma declares a text block's wrapper as the CEILING of its padding plus its pinned fractional line height, so
// the block closes on a whole pixel while the text keeps its fractional metrics (34:208 is 353x51 over 16 + 34.5
// = 50.5). The requirement is stated as that arithmetic rather than as 51, so a change to any of the three
// tokens moves the expectation with it instead of leaving a literal behind.
const FRACTIONAL_BLOCK_HEIGHT: number = Spacing.MEDIUM + LineHeight.SCREEN_TITLE
const RECONCILED_BLOCK_HEIGHT: number = Spacing.MEDIUM + LineHeight.SCREEN_TITLE + Sizes.TITLE_BLOCK_INSET_B

describe('the Review headline block', () => {
  it('closes on the whole pixel Figma declares rather than on its own fractional line box', () => {
    expect(blockHeight()).toBe(RECONCILED_BLOCK_HEIGHT)
    expect(Number.isInteger(RECONCILED_BLOCK_HEIGHT)).toBe(true)
    expect(Number.isInteger(FRACTIONAL_BLOCK_HEIGHT)).toBe(false)
  })

  // The editor's structurally identical headline reconciles the same fraction with the same token, so the two
  // screens can only agree while Review consumes it too — and only the remainder is safe to change here,
  // because the line height is shared with every other screen's title.
  it('carries the remainder as the shared token the editor uses, not a local fraction', () => {
    expect(remainder()).toBe(Sizes.TITLE_BLOCK_INSET_B)
    expect(remainder()).toBe(Math.ceil(FRACTIONAL_BLOCK_HEIGHT) - FRACTIONAL_BLOCK_HEIGHT)
  })

  it('opens the block on the drawn top inset and keeps the pinned title metrics it is measured from', () => {
    expect(topInset()).toBe(Spacing.MEDIUM)
    expect(lineBox()).toBe(LineHeight.SCREEN_TITLE)
    expect(headline.fontSize).toBe(FontSize.SCREEN_TITLE)
  })

  it('grows with the user text size instead of pinning a height that would clip a scaled title', () => {
    expect(headline.height).toBeUndefined()
    expect(headline.maxHeight).toBeUndefined()
  })
})
