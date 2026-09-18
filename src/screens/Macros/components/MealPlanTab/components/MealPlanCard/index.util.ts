import {MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT} from '@constants/strings'

export interface WritePillAccessibility {
  isDisabled: boolean
  accessibilityHint: string | undefined
}

const PRESSABLE_WITHOUT_HINT: WritePillAccessibility = {
  isDisabled: false,
  accessibilityHint: undefined
}

const PRESSABLE_WITH_RECOVERY_HINT: WritePillAccessibility = {
  isDisabled: false,
  accessibilityHint: MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT
}

const DISABLED: WritePillAccessibility = {
  isDisabled: true,
  accessibilityHint: undefined
}

/**
 * What a write pill offers assistive users, from whether it is dimmed and whether a press while dimmed runs
 * the caller's stale-plan recovery:
 * - not dimmed → its own action, so it is pressable and needs no hint
 * - dimmed while recovery is offered → still pressable and NOT announced as disabled, because the press is
 *   the only way to reload the changed plan; the hint is what makes that reachable by ear
 * - dimmed with no recovery → genuinely disabled, because the press does nothing at all
 */
export const resolveWritePillAccessibility = (
  isDimmed: boolean,
  offersStalePlanRecovery: boolean
): WritePillAccessibility => {
  if (!isDimmed) {
    return PRESSABLE_WITHOUT_HINT
  }

  return offersStalePlanRecovery ? PRESSABLE_WITH_RECOVERY_HINT : DISABLED
}
