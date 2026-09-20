import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import {BACK_AFFORDANCE_SCAFFOLD_SHIFT, BACK_CHEVRON, chevronInkOffsetAt} from '@components/icons/ChevronGeometry'

import styles from '../index.styled'

// Figma `46:152` and its twin `47:254`: a 40px circle filled `tile` with a fully rounded radius, holding the
// back chevron. Between them sits wrapper `46:154`, whose 3px left padding is the only part of it that
// reaches the render, and the glyph's own rotated frame carries its ink left of centre again. The design
// paints the ink 0.9749px left of the circle's centre.
const FIGMA_DISC_SIZE = 40
const FIGMA_GLYPH_INK_OFFSET = -0.974873734152916

const button: ViewStyle = StyleSheet.flatten(styles.button)
const glyph: ViewStyle = StyleSheet.flatten(styles.glyph)

const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const marginLeft = resolvedNumber(glyph.marginLeft, "the glyph's left margin")
const marginRight = resolvedNumber(glyph.marginRight, "the glyph's right margin")

describe('the disc is the circle Figma draws', () => {
  it('is square at Figma`s size and fully rounded', () => {
    expect(button.width).toBe(FIGMA_DISC_SIZE)
    expect(button.height).toBe(FIGMA_DISC_SIZE)
    expect(button.width).toBe(Sizes.TILE_SM)
    expect(button.borderRadius).toBe(BorderRadius.PILL)
  })

  it('centres its content on both axes, so the glyph`s own margins are what place it', () => {
    expect(button.alignItems).toBe('center')
    expect(button.justifyContent).toBe('center')
  })

  it.each([
    ['default', Theme.colors.tile],
    ['scrim', Theme.colors.heroScrim]
  ])('fills the %s variant from its token', (variant, expected) => {
    expect(StyleSheet.flatten(styles[variant as 'default' | 'scrim']).backgroundColor).toBe(expected)
  })

  // Figma gives this node no border and no effect, and `46:248` on the same screen is the only node in the
  // file that carries one, so their absence here is a design fact rather than a gap in the payload.
  it('carries neither a border nor a shadow', () => {
    expect(button.borderWidth).toBeUndefined()
    expect(button.shadowOpacity).toBeUndefined()
  })
})

describe('the glyph sits where Figma paints it inside that disc', () => {
  // Yoga lays out the margin box, so the canvas sits at the margin box's left edge plus `marginLeft`, and
  // the ink, centred in the canvas, ends up this far from the disc's centre.
  const inkOffsetFromCentre = Sizes.ICON_XL / 2 + marginLeft - (Sizes.ICON_XL + marginLeft + marginRight) / 2

  it('offsets the ink left of centre by the wrapper and the glyph`s own bias combined', () => {
    expect(inkOffsetFromCentre).toBeCloseTo(FIGMA_GLYPH_INK_OFFSET, 9)
    expect(inkOffsetFromCentre).toBeCloseTo(
      BACK_AFFORDANCE_SCAFFOLD_SHIFT + chevronInkOffsetAt('left', BACK_CHEVRON, Sizes.ICON_XL),
      9
    )
  })

  it('leaves the space the glyph occupies unchanged, so the disc still centres it', () => {
    expect(marginLeft + marginRight).toBeCloseTo(0, 9)
  })

  it('moves the glyph horizontally only, Figma`s vertical placement being exact already', () => {
    expect(glyph.marginTop).toBeUndefined()
    expect(glyph.marginBottom).toBeUndefined()
    expect(glyph.margin).toBeUndefined()
  })

  // Centring the ink was the shipped behaviour and is the thing being corrected, so a regression to it
  // should fail rather than pass quietly.
  it('is not the centred placement it replaced', () => {
    expect(inkOffsetFromCentre).not.toBe(0)
    expect(Math.abs(inkOffsetFromCentre)).toBeGreaterThan(0.5)
  })
})
