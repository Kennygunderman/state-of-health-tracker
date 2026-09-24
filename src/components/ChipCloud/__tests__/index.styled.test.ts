import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles, {CHIP_BAND_SLOP} from '../index.styled'

// A chip's hit slop is clipped to the bounds of the band that holds it, so the band reserves room for it with
// vertical padding and hands that height straight back with an equal negative margin. What is pinned here is
// both halves of that pairing — the reserve is the chips' own slop, and the give-back is exact, so the band
// still occupies the height Figma draws for a row of chips (47:177, 47:287, 47:303, 47:431, 47:619) — and the
// absence of the minimum height that previously rendered every one of those rows 44px instead.
const cloud: ViewStyle = StyleSheet.flatten(styles.cloud)
const scroll: ViewStyle = StyleSheet.flatten(styles.scroll)
const wrap: ViewStyle = StyleSheet.flatten(styles.wrap)

// Guarded rather than cast: a style value that stops being a number has to fail loudly instead of being scored
// as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const BAND_VARIANTS: ReadonlyArray<readonly [string, ViewStyle]> = [
  ['the scrolling band', scroll],
  ['the wrapping band', wrap]
]

describe('the slop the band reserves', () => {
  it('is exactly the slop a chip carries, so the reserve and the target are one number', () => {
    expect(CHIP_BAND_SLOP).toBe((Sizes.TOUCH_TARGET - Sizes.CHIP) / 2)
  })

  it('is padded into the band, which is where a clipped slop has to land', () => {
    expect(resolvedNumber(cloud.paddingVertical, "the band's vertical padding")).toBe(CHIP_BAND_SLOP)
  })

  it('makes the box a touch is tested against a full Sizes.TOUCH_TARGET around a drawn chip', () => {
    const paddingVertical = resolvedNumber(cloud.paddingVertical, "the band's vertical padding")

    expect(Sizes.CHIP + paddingVertical * 2).toBe(Sizes.TOUCH_TARGET)
  })
})

describe.each(BAND_VARIANTS)('%s', (_description, variant) => {
  it('hands the reserved height back, so the reserve costs the layout nothing', () => {
    const marginVertical = resolvedNumber(variant.marginVertical, "the band's vertical margin")
    const paddingVertical = resolvedNumber(cloud.paddingVertical, "the band's vertical padding")

    expect(marginVertical).toBe(-CHIP_BAND_SLOP)
    expect((paddingVertical + marginVertical) * 2).toBe(0)
  })

  it('declares no height of any kind, so the band hugs the chips Figma drew', () => {
    expect(variant.height).toBeUndefined()
    expect(variant.minHeight).toBeUndefined()
    expect(variant.maxHeight).toBeUndefined()
  })
})

describe('the band rhythm', () => {
  it('declares no height on the chip frame either, so nothing overrides the drawn row', () => {
    expect(cloud.height).toBeUndefined()
    expect(cloud.minHeight).toBeUndefined()
    expect(cloud.maxHeight).toBeUndefined()
  })

  it('spaces wrapped rows so their pitch is the 40px Figma draws over a 32px chip', () => {
    const gap = resolvedNumber(cloud.gap, "the band's gap")

    expect(gap).toBe(Spacing.X_SMALL)
    expect(Sizes.CHIP + gap).toBe(40)
  })

  it('keeps a single chip row from stretching down the screen body it sits in', () => {
    expect(scroll.flexGrow).toBe(0)
  })
})
