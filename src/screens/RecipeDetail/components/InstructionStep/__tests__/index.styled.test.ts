import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import styles from '../index.styled'

// `StyleSheet.create` may hand back either the style objects or registered ids depending on the React
// Native version, so values are read through `flatten`, exactly as the renderer resolves them.
const container: ViewStyle = StyleSheet.flatten(styles.container)
const badge: ViewStyle = StyleSheet.flatten(styles.badge)
const stepNumber: TextStyle = StyleSheet.flatten(styles.stepNumber)
const instructionText: TextStyle = StyleSheet.flatten(styles.instructionText)

describe('InstructionStep badge', () => {
  // The badge is sized by minimums so the digit can never outgrow it. A fixed 22px box cannot hold the
  // digit at 200% dynamic type, and the only way to make it fit would be to shrink the glyph -- which AAP
  // 0.7.4 reserves for single-line labels in fixed controls. Growing the badge keeps the digit at full size.
  it('is bounded from below, not fixed, so the digit is never shrunk to fit', () => {
    expect(badge.minWidth).toBe(Sizes.STEP_BADGE)
    expect(badge.minHeight).toBe(Sizes.STEP_BADGE)
    expect(badge.width).toBeUndefined()
    expect(badge.height).toBeUndefined()
  })

  it('pads horizontally so a two-digit step widens the badge instead of crowding the digit', () => {
    expect(badge.paddingHorizontal).toBe(Spacing.XX_SMALL)
  })

  it('renders the drawn circle of node 49:649 at the reference size', () => {
    expect(badge.borderRadius).toBe(BorderRadius.PILL)
    expect(badge.backgroundColor).toBe(Theme.colors.greenTint)
    expect(badge.alignItems).toBe('center')
    expect(badge.justifyContent).toBe('center')
  })

  // A View already defaults to `flexShrink: 0`, so the badge holds its width against the flexing body
  // without the sheet restating it.
  it('leaves shrink at the platform default rather than restating it', () => {
    expect(badge.flexShrink).toBeUndefined()
  })
})

describe('InstructionStep digit', () => {
  it('keeps the Figma-drawn type and colour', () => {
    expect(stepNumber.fontSize).toBe(FontSize.CAPTION)
    expect(stepNumber.fontWeight).toBe(FontWeight.BOLD)
    expect(stepNumber.color).toBe(Theme.colors.accentGreen)
  })
})

describe('InstructionStep body', () => {
  // The body is the flexing column here, so unlike the quantity column of the grocery and ingredient rows
  // it carries no cap: an instruction wraps to as many lines as it needs and grows the row.
  it('flexes uncapped so the instruction wraps freely and grows the row', () => {
    expect(instructionText.flex).toBe(1)
    expect(instructionText.maxWidth).toBeUndefined()
  })

  it('keeps the Figma-drawn type, line height and colour', () => {
    expect(instructionText.fontSize).toBe(FontSize.BODY)
    expect(instructionText.fontWeight).toBe(FontWeight.REGULAR)
    expect(instructionText.lineHeight).toBe(LineHeight.STEP_BODY)
    expect(instructionText.color).toBe(Theme.colors.textSecondary)
  })
})

describe('InstructionStep container', () => {
  it('top-aligns the badge against the first body line and owns no inter-step margin', () => {
    expect(container.alignItems).toBe('flex-start')
    expect(container.columnGap).toBe(Spacing.SMALL)
    expect(container.marginTop).toBeUndefined()
    expect(container.marginBottom).toBeUndefined()
  })
})
