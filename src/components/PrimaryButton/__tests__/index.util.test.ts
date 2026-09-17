import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'

import styles from '../index.styled'
import {ctaMinHeight, isDimmed, isPressBlocked} from '../index.util'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so the rendered box is read through `flatten`, exactly as the renderer resolves it. The
// stylesheet is asserted here rather than in a file of its own because the height contract is only pinned
// while the value `ctaMinHeight` returns is the value the box actually applies.
const ctaBox: ViewStyle = StyleSheet.flatten(styles.inner)

describe('isPressBlocked', () => {
  it('allows the press when the button is idle and enabled', () => {
    expect(isPressBlocked(false, false)).toBe(false)
  })

  it('blocks presses while loading', () => {
    expect(isPressBlocked(true, false)).toBe(true)
  })

  it('blocks presses when disabled', () => {
    expect(isPressBlocked(false, true)).toBe(true)
  })

  it('blocks presses when loading and disabled', () => {
    expect(isPressBlocked(true, true)).toBe(true)
  })
})

describe('isDimmed', () => {
  it('does not dim when the button is idle and enabled', () => {
    expect(isDimmed(false, false)).toBe(false)
  })

  it('does not dim while loading, because the spinner conveys that state', () => {
    expect(isDimmed(true, false)).toBe(false)
  })

  it('dims when disabled', () => {
    expect(isDimmed(false, true)).toBe(true)
  })

  it('dims when disabled while loading', () => {
    expect(isDimmed(true, true)).toBe(true)
  })
})

describe('ctaMinHeight', () => {
  it('pins the box at the height Figma authors for the CTA', () => {
    expect(ctaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET)).toBe(Sizes.CTA)
  })

  it('raises an authored height that would fall under the touch-target floor', () => {
    expect(ctaMinHeight(Sizes.CONTROL_SM, Sizes.TOUCH_TARGET)).toBe(Sizes.TOUCH_TARGET)
  })

  it('returns the shared value when the authored height is the floor', () => {
    expect(ctaMinHeight(Sizes.TOUCH_TARGET, Sizes.TOUCH_TARGET)).toBe(Sizes.TOUCH_TARGET)
  })
})

describe('the primary CTA box', () => {
  it('applies the pinned height rather than deriving one from its content', () => {
    expect(ctaBox.minHeight).toBe(ctaMinHeight(Sizes.CTA, Sizes.TOUCH_TARGET))
    expect(ctaBox.minHeight).toBe(Sizes.CTA)
  })

  it('is never shorter than the 44px touch target', () => {
    expect(ctaBox.minHeight).toBeGreaterThanOrEqual(Sizes.TOUCH_TARGET)
  })

  it('centres its label on both axes, so the label stays centred as the box grows past its content', () => {
    expect(ctaBox.alignItems).toBe('center')
    expect(ctaBox.justifyContent).toBe('center')
  })
})
