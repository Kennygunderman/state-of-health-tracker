import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import {chevronInkAt, ROW_CHEVRON} from '@components/icons/ChevronGeometry'

import styles from '../index.styled'

// Figma `47:275`: the field is 353x44 with a 1px inside stroke and 12x16 padding, and lays out a 17px
// magnifier, a filling label and an 8px chevron slot with 8px gaps between them. Its inner content box is
// 18px tall — the height of the label wrapper `47:279` — which is what the 44px outer height is built from.
const FIGMA_FIELD_WIDTH = 353
const FIGMA_MAGNIFIER_WIDTH = 17
const FIGMA_LABEL_TRACK = 278
const FIGMA_FIELD_HEIGHT = 44
const FIGMA_LABEL_HEIGHT = 18

// Figma `47:282`: the glyph's rotated frame is centred on the slot, but only its two apex-facing edges paint,
// so the ink sits this far right of the slot's centre and its point lands past the field's padding edge at
// field-local 336. Both are the design's own numbers, held here against the style's arithmetic.
const FIGMA_CHEVRON_INK_OFFSET = 2.121320343559643
const FIGMA_CHEVRON_APEX = 337.65685

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React Native
// version, so the rendered values are read through `flatten`, exactly as the renderer resolves the
// component's `[base, variant]` arrays.
const resting: ViewStyle = StyleSheet.flatten([styles.field, false && styles.fieldFocused])
const focused: ViewStyle = StyleSheet.flatten([styles.field, true && styles.fieldFocused])
const chevronSlot: ViewStyle = StyleSheet.flatten(styles.chevronSlot)

const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// Resolved once, at import: the slot's whole purpose is this number, so its absence should fail loudly here
// rather than as a single confusing assertion.
// The vertical margins are the plain collapse; the horizontal pair carries the same collapse plus Figma's
// ink offset, one added and one subtracted, so their mean is the collapse and their difference is the shift.
const chevronOverhang = resolvedNumber(chevronSlot.marginTop, "the chevron slot's top margin")
const chevronMarginLeft = resolvedNumber(chevronSlot.marginLeft, "the chevron slot's left margin")
const chevronMarginRight = resolvedNumber(chevronSlot.marginRight, "the chevron slot's right margin")

// Where the ink ends up relative to the centre of the space the row advances by, from Yoga's own box
// arithmetic: the canvas sits at the margin box's left edge plus `marginLeft`, and the ink is centred in it.
const chevronInkOffsetWithinAdvance =
  Sizes.ICON_MD / 2 + chevronMarginLeft - (Sizes.ICON_MD + chevronMarginLeft + chevronMarginRight) / 2

describe('the focus ring is a state, not a mode', () => {
  it('draws the resting boundary Figma 47:275 specifies when the field does not hold focus', () => {
    expect(resting.borderColor).toBe(Theme.colors.inputBorder)
  })

  it('draws the green boundary Figma 47:362 specifies only while the field holds focus', () => {
    expect(focused.borderColor).toBe(Theme.colors.accentGreen)
  })

  it('keeps the two boundaries distinguishable, so the composition above is observable', () => {
    expect(Theme.colors.inputBorder).not.toBe(Theme.colors.accentGreen)
  })

  it('carries the focused treatment in its own style, so it can be toggled rather than always applied', () => {
    const focusedOnly: ViewStyle = StyleSheet.flatten(styles.fieldFocused)

    expect(Object.keys(focusedOnly)).toEqual(['borderColor'])
  })
})

describe('the trailing chevron occupies the square slot Figma advances the row by', () => {
  it('collapses the glyph footprint to a Sizes.CHEVRON_SLOT square, on both axes', () => {
    // Wrapper `47:283` is 8x8 and fixed on both axes, so both axes are collapsed. Horizontally the offset
    // below is folded in, which moves the canvas without changing how much room it takes.
    expect(Sizes.ICON_MD + chevronMarginLeft + chevronMarginRight).toBeCloseTo(Sizes.CHEVRON_SLOT, 9)
    expect(Sizes.ICON_MD + 2 * chevronOverhang).toBe(Sizes.CHEVRON_SLOT)
    expect(resolvedNumber(chevronSlot.marginBottom, "the chevron slot's bottom margin")).toBe(chevronOverhang)
    expect(chevronSlot.marginHorizontal).toBeUndefined()
    expect(chevronSlot.marginVertical).toBeUndefined()
    expect(chevronSlot.margin).toBeUndefined()
  })

  it('lets the glyph overhang the slot instead of shrinking it, because the overhang is the apex', () => {
    expect(chevronOverhang).toBeLessThan(0)
  })

  it('introduces no clipping parent around the artwork', () => {
    expect(chevronSlot.overflow).toBeUndefined()
    expect(resting.overflow).toBeUndefined()
    expect(chevronSlot.width).toBeUndefined()
    expect(chevronSlot.height).toBeUndefined()
  })

  it("restores the label's 278px track, which a 20px footprint would cut to 266px", () => {
    const borderWidth = resolvedNumber(resting.borderWidth, "the field's stroke")
    const paddingHorizontal = resolvedNumber(resting.paddingHorizontal, "the field's horizontal padding")
    const gap = resolvedNumber(resting.gap, "the field's gap")

    const content = FIGMA_FIELD_WIDTH - 2 * borderWidth - 2 * paddingHorizontal
    const track = content - FIGMA_MAGNIFIER_WIDTH - Sizes.CHEVRON_SLOT - 2 * gap

    expect(track).toBe(FIGMA_LABEL_TRACK)
    expect(content - FIGMA_MAGNIFIER_WIDTH - Sizes.ICON_MD - 2 * gap).toBe(FIGMA_LABEL_TRACK - 12)
  })

  it('returns the field to its drawn height by keeping the canvas out of the cross axis', () => {
    const borderWidth = resolvedNumber(resting.borderWidth, "the field's stroke")
    const minHeight = resolvedNumber(resting.minHeight, "the field's minimum height")
    const paddingVertical = resolvedNumber(resting.paddingVertical, "the field's vertical padding")

    // Stroke and padding sit inside the field's own box, so the drawn height is chrome plus content.
    const chrome = 2 * borderWidth + 2 * paddingVertical

    expect(chrome + FIGMA_LABEL_HEIGHT).toBe(FIGMA_FIELD_HEIGHT)
    expect(minHeight).toBe(FIGMA_FIELD_HEIGHT)
    expect(paddingVertical).toBe(Spacing.SMALL)

    // The collapsed slot is shorter than the label, so the label is what sets the content height. The
    // uncollapsed canvas was taller than it, which is what stood the field 2px above its drawn height.
    expect(Sizes.ICON_MD + 2 * chevronOverhang).toBeLessThan(FIGMA_LABEL_HEIGHT)
    expect(chrome + Sizes.ICON_MD).toBe(FIGMA_FIELD_HEIGHT + 2)
  })
})

// Figma centres the chevron's rotated frame on the slot but inks only its two apex-facing edges, so the ink
// itself is not centred there: its point overhangs the field's padding edge, which is the arrow's whole
// visual job. Centred ink stops short of that edge instead.
describe('the trailing chevron points where Figma points it', () => {
  it('carries the ink right of the slot centre by Figma`s own offset', () => {
    expect(chevronInkOffsetWithinAdvance).toBeCloseTo(FIGMA_CHEVRON_INK_OFFSET, 9)
  })

  it('reaches the apex past the field`s inner padding edge, as Figma draws it', () => {
    const borderWidth = resolvedNumber(resting.borderWidth, "the field's border")
    const paddingHorizontal = resolvedNumber(resting.paddingHorizontal, "the field's horizontal padding")
    const paddingEdge = FIGMA_FIELD_WIDTH - borderWidth - paddingHorizontal
    const slotCentre = paddingEdge - Sizes.CHEVRON_SLOT / 2
    const inkWidth = chevronInkAt(ROW_CHEVRON, Sizes.ICON_MD).width
    const apex = slotCentre + chevronInkOffsetWithinAdvance + inkWidth / 2

    expect(apex).toBeCloseTo(FIGMA_CHEVRON_APEX, 4)
    expect(apex).toBeGreaterThan(paddingEdge)
  })

  it('keeps the offset horizontal only, because Figma`s vertical placement is already exact', () => {
    expect(chevronMarginLeft + chevronMarginRight).toBeCloseTo(2 * chevronOverhang, 9)
    expect(chevronMarginLeft).not.toBe(chevronMarginRight)
  })
})
