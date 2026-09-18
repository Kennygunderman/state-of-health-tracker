import {MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT} from '@constants/strings'

import {resolveWritePillAccessibility} from '../index.util'

// The card dims Swap and the unlogged primary together off one write verdict, and the tab offers stale-plan
// recovery only when the day answered `isWritable === false`. Those are the two inputs under test.
const DIMMED = true
const LIVE = false
const RECOVERY_OFFERED = true
const NO_RECOVERY = false

describe('resolveWritePillAccessibility', () => {
  it('keeps a dimmed pill pressable and unannounced as disabled when a press recovers the stale plan', () => {
    const pill = resolveWritePillAccessibility(DIMMED, RECOVERY_OFFERED)

    expect(pill.isDisabled).toBe(false)
    expect(pill.accessibilityHint).toBe(MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT)
  })

  it('disables a dimmed pill whose press does nothing, and offers it no hint', () => {
    const pill = resolveWritePillAccessibility(DIMMED, NO_RECOVERY)

    expect(pill.isDisabled).toBe(true)
    expect(pill.accessibilityHint).toBeUndefined()
  })

  it('leaves a live pill enabled and hintless, since its own action is what a press takes', () => {
    const pill = resolveWritePillAccessibility(LIVE, NO_RECOVERY)

    expect(pill.isDisabled).toBe(false)
    expect(pill.accessibilityHint).toBeUndefined()
  })

  it('never puts the recovery hint on a live pill, whatever the day answered', () => {
    const pill = resolveWritePillAccessibility(LIVE, RECOVERY_OFFERED)

    expect(pill.isDisabled).toBe(false)
    expect(pill.accessibilityHint).toBeUndefined()
  })

  // "View in diary" reads an entry that already exists, so the card never dims it. It therefore reaches this
  // helper live even while the day refuses writes and must behave exactly as it did before the helper existed.
  it('leaves the logged primary action untouched while the day refuses writes', () => {
    const loggedPrimary = resolveWritePillAccessibility(LIVE, RECOVERY_OFFERED)

    expect(loggedPrimary).toEqual(resolveWritePillAccessibility(LIVE, NO_RECOVERY))
    expect(loggedPrimary.isDisabled).toBe(false)
    expect(loggedPrimary.accessibilityHint).toBeUndefined()
  })

  it('announces the recovery in exactly one of the four states', () => {
    const hinted = [
      resolveWritePillAccessibility(DIMMED, RECOVERY_OFFERED),
      resolveWritePillAccessibility(DIMMED, NO_RECOVERY),
      resolveWritePillAccessibility(LIVE, RECOVERY_OFFERED),
      resolveWritePillAccessibility(LIVE, NO_RECOVERY)
    ].filter(pill => pill.accessibilityHint !== undefined)

    expect(hinted).toHaveLength(1)
  })

  it('disables in exactly one of the four states, and only there', () => {
    const disabled = [
      resolveWritePillAccessibility(DIMMED, RECOVERY_OFFERED),
      resolveWritePillAccessibility(DIMMED, NO_RECOVERY),
      resolveWritePillAccessibility(LIVE, RECOVERY_OFFERED),
      resolveWritePillAccessibility(LIVE, NO_RECOVERY)
    ].filter(pill => pill.isDisabled)

    expect(disabled).toHaveLength(1)
    expect(disabled[0]).toEqual(resolveWritePillAccessibility(DIMMED, NO_RECOVERY))
  })
})
