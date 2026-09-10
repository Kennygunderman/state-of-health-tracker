import {isDimmed, isPressBlocked} from '../index.util'

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
