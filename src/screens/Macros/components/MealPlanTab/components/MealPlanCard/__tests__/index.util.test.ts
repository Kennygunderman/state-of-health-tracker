import {
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_OPEN_RECIPE_LOGGED_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_RECOVERY_ACCESSIBILITY_HINT,
  stringWithNamedParameters
} from '@constants/strings'

import {openRecipeAccessibilityLabel, resolveWritePillAccessibility} from '../index.util'

// The card dims Swap and the unlogged primary together off one write verdict, and the tab offers stale-plan
// recovery only when the day answered `isWritable === false`. Those are the two inputs under test.
const DIMMED = true
const LIVE = false
const RECOVERY_OFFERED = true
const NO_RECOVERY = false

// The card resolves `loggedState.kind` to this one boolean before it labels the open-recipe element:
// only `logged` is true, and `loggedThenSwapped` renders its replacement unlogged.
const LOGGED = true
const UNLOGGED = false

const RECIPE_NAME = 'Tuna and avocado breakfast bowl'
// A comma and an apostrophe are exactly what a naive escape or a regex-based interpolation would mangle, and
// the comma is also the separator the logged suffix uses — so this name proves the two never interfere.
const PUNCTUATED_RECIPE_NAME = "Chef's bowl, extra greens"

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

describe('openRecipeAccessibilityLabel', () => {
  // Everything after the placeholder in the logged template is the badge's text equivalent; deriving it here
  // rather than writing it out keeps the assertion true if the copy is reworded.
  const LOGGED_SUFFIX = MEAL_PLAN_OPEN_RECIPE_LOGGED_ACCESSIBILITY_TEMPLATE.split('{recipe}')[1]

  it('ends a logged card name with the logged suffix', () => {
    const label = openRecipeAccessibilityLabel(RECIPE_NAME, LOGGED)

    expect(LOGGED_SUFFIX).not.toBe('')
    expect(label).toBe(
      stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_LOGGED_ACCESSIBILITY_TEMPLATE, {recipe: RECIPE_NAME})
    )
    expect(label.endsWith(LOGGED_SUFFIX)).toBe(true)
  })

  it('never announces a logged card the same way as an unlogged one for the same recipe', () => {
    expect(openRecipeAccessibilityLabel(RECIPE_NAME, LOGGED)).not.toBe(
      openRecipeAccessibilityLabel(RECIPE_NAME, UNLOGGED)
    )
  })

  it('leaves the unlogged card announcing exactly what it announced before the logged state was named', () => {
    const label = openRecipeAccessibilityLabel(RECIPE_NAME, UNLOGGED)

    expect(label).toBe(stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {recipe: RECIPE_NAME}))
    expect(label.endsWith(LOGGED_SUFFIX)).toBe(false)
  })

  it('interpolates a recipe name carrying a comma and an apostrophe verbatim in both states', () => {
    expect(openRecipeAccessibilityLabel(PUNCTUATED_RECIPE_NAME, UNLOGGED)).toContain(PUNCTUATED_RECIPE_NAME)
    expect(openRecipeAccessibilityLabel(PUNCTUATED_RECIPE_NAME, LOGGED)).toContain(PUNCTUATED_RECIPE_NAME)
    expect(openRecipeAccessibilityLabel(PUNCTUATED_RECIPE_NAME, LOGGED)).toBe(
      `${openRecipeAccessibilityLabel(PUNCTUATED_RECIPE_NAME, UNLOGGED)}${LOGGED_SUFFIX}`
    )
  })

  it('leaves no placeholder in either name', () => {
    expect(openRecipeAccessibilityLabel(RECIPE_NAME, LOGGED)).not.toContain('{recipe}')
    expect(openRecipeAccessibilityLabel(RECIPE_NAME, UNLOGGED)).not.toContain('{recipe}')
  })
})
