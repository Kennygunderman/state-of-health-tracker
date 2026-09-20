import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// The chip is drawn 32px tall (`47:178`/`47:187`) and its rows are drawn 40px (`47:177`, `47:287`, `47:303`,
// `47:431`, `47:619`). A chip pressable grown to the 44px touch minimum renders every one of those rows 44px,
// which is the defect this file exists to keep out: what is pinned here is that the chip's box is still derived
// from its own padding and label, that it lands on Sizes.CHIP, and that the shortfall to Sizes.TOUCH_TARGET is
// exactly what the chip's hit slop and each band's reserve carry (see the note in index.tsx).
const container: ViewStyle = StyleSheet.flatten(styles.container)
const containerSelected: ViewStyle = StyleSheet.flatten(styles.containerSelected)
const label: TextStyle = StyleSheet.flatten(styles.label)
const removeGlyph: TextStyle = StyleSheet.flatten(styles.removeGlyph)

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a percentage
// string — has to fail loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

describe('the chip pill box', () => {
  it('declares no height of any kind, so the pill is whatever its padding and label make it', () => {
    expect(container.height).toBeUndefined()
    expect(container.minHeight).toBeUndefined()
    expect(container.maxHeight).toBeUndefined()
  })

  it('leaves its label line height to the base text size, so the box follows the type', () => {
    expect(label.lineHeight).toBeUndefined()
  })

  it('measures the drawn Sizes.CHIP from its own padding and that label box', () => {
    const paddingVertical = resolvedNumber(container.paddingVertical, "the pill's vertical padding")

    expect(paddingVertical * 2 + LineHeight.LABEL).toBe(Sizes.CHIP)
  })

  it('changes only its fill when selected, so selection never moves the paint', () => {
    expect(Object.keys(containerSelected)).toEqual(['backgroundColor'])
  })
})

describe('the remove glyph a selected chip adds', () => {
  // The selected variant renders a second child next to the label (`47:431`), and the reason Figma's selected
  // pill is no taller than its unselected one is that the glyph's box is the same 16px line box as the label:
  // the pill measures max(label, glyph) + padding, so a glyph with its own taller line height would lift every
  // selected band off Sizes.CHIP without any rule here declaring a height at all.
  it('carries the label type metrics exactly, so both line boxes resolve to one height', () => {
    expect(removeGlyph.fontSize).toBe(label.fontSize)
    expect(removeGlyph.fontWeight).toBe(label.fontWeight)
  })

  it('declares no line height or box of its own, so it costs width and no height', () => {
    expect(removeGlyph.lineHeight).toBeUndefined()
    expect(removeGlyph.height).toBeUndefined()
    expect(removeGlyph.minHeight).toBeUndefined()
    expect(removeGlyph.maxHeight).toBeUndefined()
  })

  // The label is the one child that may give up width, so a crowded band squeezes the label and never the
  // glyph. That ordering is what keeps a wrapped label the only way a pill can grow, which the label's own
  // absent line height then bounds to whole 16px lines.
  it('refuses to shrink, so the label absorbs a crowded row instead', () => {
    expect(removeGlyph.flexShrink).toBe(0)
    expect(label.flexShrink).toBe(1)
  })
})

describe('the touch target the chip reaches without growing', () => {
  it('closes the whole gap to Sizes.TOUCH_TARGET with one Spacing.TIGHT above and below', () => {
    expect(Sizes.CHIP + 2 * Spacing.TIGHT).toBe(Sizes.TOUCH_TARGET)
  })
})

describe('the taller pressable this component must not reacquire', () => {
  it('declares no touch host, so no call site can opt a chip row up to 44px', () => {
    const declared = styles as unknown as Record<string, unknown>

    expect(declared.touchHost).toBeUndefined()
  })

  it('declares no height on any rule it owns, wherever a host might reappear', () => {
    Object.entries(styles as unknown as Record<string, ViewStyle>).forEach(([name, rule]) => {
      const flattened: ViewStyle = StyleSheet.flatten(rule)

      expect({name, height: flattened.height}).toEqual({name, height: undefined})
      expect({name, minHeight: flattened.minHeight}).toEqual({name, minHeight: undefined})
      expect({name, maxHeight: flattened.maxHeight}).toEqual({name, maxHeight: undefined})
    })
  })
})
