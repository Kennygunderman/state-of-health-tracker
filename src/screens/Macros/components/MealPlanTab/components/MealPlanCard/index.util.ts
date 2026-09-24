import {
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_OPEN_RECIPE_LOGGED_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT,
  stringWithNamedParameters
} from '@constants/strings'

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

/**
 * The name the card's open-recipe element announces. An explicit label on an accessible pressable replaces
 * every descendant, so the visible LOGGED badge inside that element cannot speak for itself and the logged
 * template's suffix is the badge's only text equivalent: without it a logged and an unlogged card announce
 * identically and the primary element contradicts what is drawn.
 */
export const openRecipeAccessibilityLabel = (recipeName: string, isLogged: boolean): string =>
  stringWithNamedParameters(
    isLogged ? MEAL_PLAN_OPEN_RECIPE_LOGGED_ACCESSIBILITY_TEMPLATE : MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
    {recipe: recipeName}
  )
