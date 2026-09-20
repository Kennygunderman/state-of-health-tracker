import {StyleSheet, ViewStyle} from 'react-native'

import {LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import chipStyles from '@components/SelectableChip/index.styled'

import styles, {CHIP_PILL_HEIGHT, CHIP_PILL_WIDTHS} from '../index.styled'

// This placeholder has one requirement nothing it renders can state on its own: a placeholder row must occupy
// the height of the chip row it stands for, or the helper text and the error row below the cloud move when the
// saved answer lands. A loaded chip reaches its 44px touch target through slop the band reserves and hands
// straight back to the layout (@components/ChipCloud), so the drawn row is the pill and nothing more — and a
// host that reserved the target here instead would stand every placeholder row 12px too tall. The requirement
// is therefore asserted against SelectableChip's own stylesheet, so a later change to the chip's padding or
// label box fails here rather than on a device.
const pillHost: ViewStyle = StyleSheet.flatten(styles.pillHost)
const loadedChip: ViewStyle = StyleSheet.flatten(chipStyles.container)

// Guarded rather than cast: a style value that stops being a number has to fail the assertion that states
// what it is for, instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

describe('the height a placeholder row reserves', () => {
  it('is the drawn chip height, not the touch target the band reserves around it', () => {
    expect(resolvedNumber(pillHost.minHeight, "the placeholder host's minimum height")).toBe(Sizes.CHIP)
    expect(resolvedNumber(pillHost.minHeight, "the placeholder host's minimum height")).not.toBe(Sizes.TOUCH_TARGET)
  })

  // Derived the way SelectableChip's own suite derives it — padding around the label's line box — so the two
  // rows are pinned to one arithmetic rather than to two copies of the number 32.
  it('is the height the loaded chip derives from its own padding and label box', () => {
    const derivedChipHeight =
      2 * resolvedNumber(loadedChip.paddingVertical, "the loaded chip's vertical padding") + LineHeight.LABEL

    expect(derivedChipHeight).toBe(Sizes.CHIP)
    expect(resolvedNumber(pillHost.minHeight, "the placeholder host's minimum height")).toBe(derivedChipHeight)
  })

  it('draws the pill at that same height, so the host reserves nothing the bar does not fill', () => {
    expect(CHIP_PILL_HEIGHT).toBe(Sizes.CHIP)
  })

  it('centres the pill in the row, which is what ChipCloud measures', () => {
    expect(pillHost.justifyContent).toBe('center')
  })

  it('reserves no slop of its own: a placeholder is not pressable', () => {
    expect(pillHost.paddingVertical).toBeUndefined()
    expect(pillHost.marginVertical).toBeUndefined()
  })
})

describe('the widths a placeholder cloud wraps at', () => {
  it('offers several, so the placeholder cloud wraps like the answer rather than like identical blocks', () => {
    expect(new Set(CHIP_PILL_WIDTHS).size).toBe(CHIP_PILL_WIDTHS.length)
    expect(CHIP_PILL_WIDTHS.length).toBeGreaterThan(1)
  })

  it('stays inside a chip label plus its own horizontal padding at the narrow end', () => {
    const chipChrome = 2 * resolvedNumber(loadedChip.paddingHorizontal, "the loaded chip's side padding")

    CHIP_PILL_WIDTHS.forEach(width => {
      expect(width).toBeGreaterThan(chipChrome)
      expect(width).toBeLessThan(Sizes.CONTENT_MAX_WIDTH)
    })
  })

  it('is authored from tokens, so no measured literal can drift from the chips it stands for', () => {
    const tokenWidths = new Set<number>(
      Object.values(Sizes).filter((value): value is number => typeof value === 'number')
    )

    CHIP_PILL_WIDTHS.forEach(width => {
      expect(tokenWidths.has(width)).toBe(true)
    })
  })

  // The gap between placeholders belongs to the band, exactly as it does for the loaded chips, so this host
  // declares none of its own.
  it('leaves the gap between rows to the band that holds them', () => {
    expect(pillHost.gap).toBeUndefined()
    expect(Spacing.X_SMALL).toBeGreaterThan(0)
  })
})
