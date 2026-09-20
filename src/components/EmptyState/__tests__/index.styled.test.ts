import {StyleSheet, TextStyle, ViewStyle} from 'react-native'

import type {EmptyStateBottomInset} from '../index'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'

import styles from '../index.styled'

// EmptyState carries two vertical rhythms that cannot be reconciled into one sequence: the full-screen tile
// (frames `49:461` / `37:377`, gaps 20/12/24/8 with a 40 or 60 bottom inset) and the in-card badge (frame
// `36:414`, gaps 16/8/20/8 with no inset at all, because the host card's own 20pt padding is the only space
// below the last button). Both resolve out of this one stylesheet, so these numbers are the only place the two
// can be told apart — and the only thing that fails if a later edit unifies them.
const container = StyleSheet.flatten<ViewStyle>(styles.container)
const containerInsetLg = StyleSheet.flatten<ViewStyle>(styles.containerInsetLg)
const containerInsetNone = StyleSheet.flatten<ViewStyle>(styles.containerInsetNone)
const headline = StyleSheet.flatten<TextStyle>(styles.headline)
const headlineCompact = StyleSheet.flatten<TextStyle>(styles.headlineCompact)
const body = StyleSheet.flatten<TextStyle>(styles.body)
const bodyCompact = StyleSheet.flatten<TextStyle>(styles.bodyCompact)
const action = StyleSheet.flatten<ViewStyle>(styles.action)
const actionCompact = StyleSheet.flatten<ViewStyle>(styles.actionCompact)
const actionStacked = StyleSheet.flatten<ViewStyle>(styles.actionStacked)

// Guarded rather than cast, and read inside the tests rather than at module scope: a gap that stops being a
// number — dropped, or authored as a percentage string — has to fail the assertion that states what it is for,
// instead of being scored as `undefined` or crashing the suite before any test names the requirement.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

// Composed exactly the way `index.tsx` composes them, so the effective gap is asserted rather than the key
// values alone: a modifier placed before the base it overrides, or a guard wired to the wrong prop, loses the
// override silently and has to fail here.
const composedContainer = (bottomInset: EmptyStateBottomInset): ViewStyle =>
  StyleSheet.flatten<ViewStyle>([
    styles.container,
    bottomInset === 'lg' && styles.containerInsetLg,
    bottomInset === 'none' && styles.containerInsetNone
  ])

const composedHeadline = (isBadge: boolean): TextStyle =>
  StyleSheet.flatten<TextStyle>([styles.headline, isBadge ? styles.headlineCompact : styles.headlineLarge])

const composedBody = (isBadge: boolean): TextStyle =>
  StyleSheet.flatten<TextStyle>([styles.body, isBadge && styles.bodyCompact])

const composedAction = (isBadge: boolean): ViewStyle =>
  StyleSheet.flatten<ViewStyle>([styles.action, isBadge && styles.actionCompact])

const composedSecondaryAction = (isBadge: boolean, hasPrimaryAction: boolean): ViewStyle =>
  hasPrimaryAction ? StyleSheet.flatten<ViewStyle>(styles.actionStacked) : composedAction(isBadge)

const gap = (style: ViewStyle | TextStyle, description: string): number => resolvedNumber(style.marginTop, description)

const inset = (style: ViewStyle, description: string): number => resolvedNumber(style.paddingBottom, description)

describe('the full-screen tile gap sequence', () => {
  it('opens the headline a gutter below the 104pt tile', () => {
    expect(gap(headline, "the tile headline's top gap")).toBe(20)
    expect(headline.marginTop).toBe(Spacing.GUTTER)
  })

  it('keeps the drawn 12 / 24 / 8 rhythm through body, primary and stacked secondary', () => {
    expect(gap(body, "the tile body's top gap")).toBe(12)
    expect(gap(action, "the tile primary action's top gap")).toBe(24)
    expect(gap(actionStacked, "the stacked secondary action's top gap")).toBe(8)
  })

  it('carries the sequence on the unsuffixed keys, so the tile needs no modifier to render it', () => {
    expect(headlineCompact.marginTop).not.toBe(headline.marginTop)
    expect(bodyCompact.marginTop).not.toBe(body.marginTop)
    expect(actionCompact.marginTop).not.toBe(action.marginTop)
  })
})

describe('the in-card badge gap sequence of frame 36:414', () => {
  it('tightens the headline, body and primary gaps to 16 / 8 / 20', () => {
    expect(gap(headlineCompact, "the badge headline's top gap")).toBe(16)
    expect(gap(bodyCompact, "the badge body's top gap")).toBe(8)
    expect(gap(actionCompact, "the badge primary action's top gap")).toBe(20)
  })

  it('resolves each of those gaps from a spacing token rather than a literal', () => {
    expect(headlineCompact.marginTop).toBe(Spacing.MEDIUM)
    expect(bodyCompact.marginTop).toBe(Spacing.X_SMALL)
    expect(actionCompact.marginTop).toBe(Spacing.GUTTER)
  })

  // The fourth gap is 8 in both variants, which is why no `actionStackedCompact` exists: the stacked secondary
  // needs no override, and adding one would be the first place the two sequences could drift apart unnoticed.
  it('shares the stacked secondary gap with the tile instead of overriding it', () => {
    expect(gap(actionStacked, "the stacked secondary action's top gap")).toBe(8)
    expect(actionStacked.marginTop).toBe(bodyCompact.marginTop)
  })

  it('keeps the compact headline at the card title size with no line box of its own', () => {
    expect(headlineCompact.fontSize).toBe(17)
    expect(headlineCompact.lineHeight).toBeUndefined()
    expect(headlineCompact.letterSpacing).toBeUndefined()
  })
})

describe('the three bottom insets', () => {
  it('defaults the block to the 40pt inset frame 49:461 draws', () => {
    expect(inset(container, 'the default empty-block bottom inset')).toBe(40)
    expect(container.paddingBottom).toBe(Sizes.EMPTY_BLOCK_BOTTOM)
  })

  it('lifts it to 60 for the wider block frame 37:377 draws', () => {
    expect(inset(containerInsetLg, 'the large empty-block bottom inset')).toBe(60)
    expect(containerInsetLg.paddingBottom).toBe(Sizes.EMPTY_BLOCK_BOTTOM_LG)
  })

  // Zero, not a token: the in-card badge has no inset of its own, and `0` is a structural value rather than a
  // design one (it is exempt in scripts/token-literal-scan.mjs for exactly that reason).
  it('removes it entirely for a block hosted inside a padded card', () => {
    expect(inset(containerInsetNone, 'the suppressed empty-block bottom inset')).toBe(0)
  })
})

describe('the style arrays the component composes', () => {
  it('renders the 13d badge block at 16 / 8 / 20 / 8 with no bottom inset', () => {
    expect(inset(composedContainer('none'), "the 13d container's bottom inset")).toBe(0)
    expect(gap(composedHeadline(true), "the 13d headline's effective top gap")).toBe(16)
    expect(gap(composedBody(true), "the 13d body's effective top gap")).toBe(8)
    expect(gap(composedAction(true), "the 13d primary action's effective top gap")).toBe(20)
    expect(gap(composedSecondaryAction(true, true), "the 13d secondary action's effective top gap")).toBe(8)
  })

  it('renders the default tile block at 20 / 12 / 24 / 8 over a 40pt inset', () => {
    expect(inset(composedContainer('sm'), "the default container's bottom inset")).toBe(40)
    expect(gap(composedHeadline(false), "the tile headline's effective top gap")).toBe(20)
    expect(gap(composedBody(false), "the tile body's effective top gap")).toBe(12)
    expect(gap(composedAction(false), "the tile primary action's effective top gap")).toBe(24)
    expect(gap(composedSecondaryAction(false, true), "the tile secondary action's effective top gap")).toBe(8)
  })

  it('renders the large tile block at the same gaps over a 60pt inset', () => {
    expect(inset(composedContainer('lg'), "the large container's bottom inset")).toBe(60)
    expect(gap(composedHeadline(false), "the tile headline's effective top gap")).toBe(20)
    expect(gap(composedBody(false), "the tile body's effective top gap")).toBe(12)
    expect(gap(composedAction(false), "the tile primary action's effective top gap")).toBe(24)
  })

  // A secondary rendered without a primary takes the body→action gap, not the stacked one — and it has to take
  // its own variant's value, which is the case the array form on that wrapper exists for.
  it('gives a secondary with no primary above it the variant own body-to-action gap', () => {
    expect(gap(composedSecondaryAction(true, false), "the badge lone secondary's top gap")).toBe(20)
    expect(gap(composedSecondaryAction(false, false), "the tile lone secondary's top gap")).toBe(24)
  })

  it('keeps the headline size the variant draws while the gap is applied', () => {
    expect(composedHeadline(true).fontSize).toBe(17)
    expect(composedHeadline(false).fontSize).toBe(30)
  })
})
