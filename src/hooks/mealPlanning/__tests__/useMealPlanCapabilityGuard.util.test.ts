import {MealPlanAvailability, MealPlanEntitlement} from '@utility/MealPlanEntitlementUtility'

import {resolveMealPlanCapabilityGuard} from '../useMealPlanCapabilityGuard.util'

const entitlement = (availability: MealPlanAvailability, hasPlan = true): MealPlanEntitlement => ({
  availability,
  isSegmentedControlVisible: availability !== 'disabled',
  isCatalogVisible: availability !== 'disabled',
  isGatedRequestAllowed: availability === 'enabled',
  hasPlan
})

describe('resolveMealPlanCapabilityGuard', () => {
  it('lets a gated screen work normally while the feature is live', () => {
    expect(resolveMealPlanCapabilityGuard(entitlement('enabled'))).toEqual({
      isGatedRequestAllowed: true,
      isCapabilityUnavailable: false
    })
  })

  // The finding, in one line: a confirmed capability refusal from ANY gated route — a setup save, a nested plan
  // read, a keyed write — is terminal for a gated screen, so it must be reported as a departure rather than as
  // one more failure the screen can offer to retry (AAP 0.2.5).
  it('reports the terminal verdict when a gated route has confirmed the capability off', () => {
    expect(resolveMealPlanCapabilityGuard(entitlement('unavailable'))).toEqual({
      isGatedRequestAllowed: false,
      isCapabilityUnavailable: true
    })
  })

  // The Remote Config flag is read once per launch (AAP 0.4.3, 0.7.5), and while it is off the Meal Plan
  // segment renders no entry to any gated screen — so a user cannot be inside one and then meet it. A departure
  // for this state would be a path nothing can take, and would dress a launch-time read as a mid-session
  // revocation the app does not implement. Requests are still refused, which is the part that matters.
  it('refuses gated requests but does not depart when the feature is merely switched off', () => {
    expect(resolveMealPlanCapabilityGuard(entitlement('disabled', false))).toEqual({
      isGatedRequestAllowed: false,
      isCapabilityUnavailable: false
    })
  })

  // The two members answer different questions, so neither may be derived from the other: a screen that read
  // the departure off `!isGatedRequestAllowed` would leave on the switched-off state too, and a screen that read
  // the request gate off `!isCapabilityUnavailable` would issue a gated probe while the flag is off.
  it('never collapses the two questions into one', () => {
    const availabilities: MealPlanAvailability[] = ['enabled', 'disabled', 'unavailable']
    const guards = availabilities.map(availability => resolveMealPlanCapabilityGuard(entitlement(availability)))

    expect(guards.map(guard => guard.isGatedRequestAllowed)).toEqual([true, false, false])
    expect(guards.map(guard => guard.isCapabilityUnavailable)).toEqual([false, false, true])
  })

  it('reads the request gate straight from the entitlement rather than re-deriving it', () => {
    const contradictory: MealPlanEntitlement = {...entitlement('enabled'), isGatedRequestAllowed: false}

    expect(resolveMealPlanCapabilityGuard(contradictory).isGatedRequestAllowed).toBe(false)
  })
})
