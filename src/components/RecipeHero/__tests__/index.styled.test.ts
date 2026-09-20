import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import styles, {backButtonPosition, heroGlyphSize} from '../index.styled'

// The band AAP 0.2.3 fixes at 180 dp of `greenTint` with a scrim back button and a glyph of 76 (`49:534`,
// frame 12) or 70 (`36:132`, frame 13b) — and the same band AAP 0.2.5 reuses while the recipe read is still in
// flight, where the glyph and the context pill give way to a `Skeleton` and the geometry and the back control
// stay. That reuse is why the two derivations here are worth pinning: `backButtonPosition` places the only
// on-screen exit a route drawn with `headerShown: false` and a hidden tab bar has, and `heroGlyphSize` is the
// per-frame glyph size. The band and slot styles both variants share are pinned with them.
const band = StyleSheet.flatten<ViewStyle>(styles.band)
const content = StyleSheet.flatten<ViewStyle>(styles.content)
const backSlot = StyleSheet.flatten<ViewStyle>(styles.backSlot)

// The insets the slot is placed under in practice: a device with no top inset, a notched phone, and the
// tallest inset iOS reports (Dynamic Island in landscape-safe portrait terms).
const RESTING_INSET = 0
const NOTCH_INSET = 20
const TALL_INSET = 59

// The stacking index `RecipeHero` hands the slot: one above the implicit zero of the band's in-flow child,
// which is the glyph/pill layer in the recipe variant and the `Skeleton` in the pending one.
const SLOT_LAYER = 1

const FIGMA_BAND_HEIGHT = 180
const FIGMA_HERO_GLYPH = 76
const FIGMA_PREVIEW_GLYPH = 70
const FIGMA_BACK_OFFSET = 4

// `BackCircleButton` draws a 40 dp disc and pads it out to the 44 dp minimum target with `hitSlop`, so the
// slot's real vertical extent starts half a slop above its `top` and ends half a slop below the disc.
const BACK_TARGET_SLOP = (Sizes.TOUCH_TARGET - Sizes.TILE_SM) / 2

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a percentage
// string — has to fail the test loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const resolvedColor = (value: unknown, description: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`Expected ${description} to resolve to a colour string, received ${String(value)}`)
  }

  return value
}

describe('backButtonPosition', () => {
  it('drops the slot the extra-extra-small token below whatever top inset the device reports', () => {
    expect(resolvedNumber(backButtonPosition(RESTING_INSET, SLOT_LAYER).top, 'the resting top')).toBe(FIGMA_BACK_OFFSET)
    expect(resolvedNumber(backButtonPosition(NOTCH_INSET, SLOT_LAYER).top, 'the notch top')).toBe(
      NOTCH_INSET + Spacing.XX_SMALL
    )
    expect(resolvedNumber(backButtonPosition(TALL_INSET, SLOT_LAYER).top, 'the tall top')).toBe(
      TALL_INSET + Spacing.XX_SMALL
    )
  })

  it('offsets by the token rather than by the 50 px status band Figma draws and this screen never does', () => {
    expect(Spacing.XX_SMALL).toBe(FIGMA_BACK_OFFSET)
    expect(resolvedNumber(backButtonPosition(NOTCH_INSET, SLOT_LAYER).top, 'the notch top')).toBe(24)
    expect(resolvedNumber(backButtonPosition(TALL_INSET, SLOT_LAYER).top, 'the tall top')).toBe(63)
  })

  it('carries the caller-owned stacking index through unchanged', () => {
    expect(backButtonPosition(RESTING_INSET, SLOT_LAYER).zIndex).toBe(SLOT_LAYER)
    expect(backButtonPosition(TALL_INSET, SLOT_LAYER).zIndex).toBe(SLOT_LAYER)
  })

  it('leaves the band and its content layer unlayered, so the slot is the one thing lifted above the flow', () => {
    expect(band.zIndex).toBeUndefined()
    expect(content.zIndex).toBeUndefined()
    expect(resolvedNumber(backButtonPosition(RESTING_INSET, SLOT_LAYER).zIndex, 'the slot layer')).toBeGreaterThan(0)
  })

  it('places nothing else, leaving the horizontal placement to the static slot style', () => {
    expect(Object.keys(backButtonPosition(NOTCH_INSET, SLOT_LAYER)).sort()).toEqual(['top', 'zIndex'])
  })

  it('keeps the whole 44 px back target inside the 180 dp band at every inset it can receive', () => {
    const bandHeight = resolvedNumber(band.height, "the band's height")

    ;[RESTING_INSET, NOTCH_INSET, TALL_INSET].forEach(inset => {
      const top = resolvedNumber(backButtonPosition(inset, SLOT_LAYER).top, `the top at inset ${inset}`)

      expect(top - BACK_TARGET_SLOP).toBeGreaterThanOrEqual(0)
      expect(top + Sizes.TILE_SM + BACK_TARGET_SLOP).toBeLessThanOrEqual(bandHeight)
    })
  })
})

describe('heroGlyphSize', () => {
  it('renders frame 12 at the 76 dp hero glyph', () => {
    expect(heroGlyphSize('detail')).toBe(Sizes.HERO_TILE)
    expect(heroGlyphSize('detail')).toBe(FIGMA_HERO_GLYPH)
  })

  it("renders 13b's preview cloche at the 70 dp glyph", () => {
    expect(heroGlyphSize('preview')).toBe(Sizes.HERO_TILE_SM)
    expect(heroGlyphSize('preview')).toBe(FIGMA_PREVIEW_GLYPH)
  })

  it('never returns the detail size for the preview band, which is the smaller of the two', () => {
    expect(heroGlyphSize('preview')).toBeLessThan(heroGlyphSize('detail'))
  })
})

describe('the band both the recipe and the pending variant render', () => {
  it('stretches across its parent and stands the Figma 180 dp tall, full-bleed past the content column', () => {
    expect(band.alignSelf).toBe('stretch')
    expect(resolvedNumber(band.height, "the band's height")).toBe(Sizes.HERO_BAND_H)
    expect(resolvedNumber(band.height, "the band's height")).toBe(FIGMA_BAND_HEIGHT)
    expect(band.width).toBeUndefined()
    expect(band.maxWidth).toBeUndefined()
  })

  it('paints the hero fill, which is what the pending variant keeps by reusing this style', () => {
    expect(resolvedColor(band.backgroundColor, "the band's fill")).toBe(Theme.colors.greenTint)
  })

  it('centres its single in-flow child on both axes', () => {
    expect(band.flexDirection).toBe('row')
    expect(band.alignItems).toBe('center')
    expect(band.justifyContent).toBe('center')
  })
})

describe('the back slot both variants place', () => {
  it('is taken out of the band flow, so neither the content layer nor the placeholder can displace it', () => {
    expect(backSlot.position).toBe('absolute')
  })

  it('sits on the page gutter', () => {
    expect(resolvedNumber(backSlot.left, "the slot's left inset")).toBe(Spacing.GUTTER)
    expect(backSlot.right).toBeUndefined()
  })

  it('declares no vertical placement of its own, which is what makes the live inset the only source', () => {
    expect(backSlot.top).toBeUndefined()
    expect(backSlot.bottom).toBeUndefined()
  })
})
