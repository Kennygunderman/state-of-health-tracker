import {SetupStep} from '@data/models/MealPlanPreferences'

import Screens from '@constants/screens'

import {resolveSetupResumeTarget} from '../MealPlanSetupResumeUtility'

describe('resolveSetupResumeTarget', () => {
  it('opens the saved wizard step itself, in setup mode', () => {
    expect(resolveSetupResumeTarget('goal')).toEqual({route: Screens.MEAL_PLAN_GOAL, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('body')).toEqual({route: Screens.MEAL_PLAN_ABOUT_YOU, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('activity')).toEqual({route: Screens.MEAL_PLAN_ACTIVITY, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('diet')).toEqual({route: Screens.MEAL_PLAN_DIET, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('dislikes')).toEqual({
      route: Screens.MEAL_PLAN_FOOD_PREFERENCES,
      params: {mode: 'setup'}
    })
    expect(resolveSetupResumeTarget('schedule')).toEqual({route: Screens.MEAL_PLAN_SCHEDULE, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('cooking')).toEqual({
      route: Screens.MEAL_PLAN_COOKING_BUDGET,
      params: {mode: 'setup'}
    })
  })

  it('opens Review for a setup that has reached it', () => {
    expect(resolveSetupResumeTarget('review')).toEqual({route: Screens.MEAL_PLAN_TARGETS, params: {mode: 'setup'}})
  })

  it('opens the manual editor, whose return carries the wizard forward into Diet', () => {
    expect(resolveSetupResumeTarget('targets_manual')).toEqual({
      route: Screens.MEAL_PLAN_EDIT_TARGETS,
      params: {mode: 'manual', returnTo: {kind: 'stack', route: 'diet'}}
    })
  })

  it('falls back to the first step for an absent or unrecognised step', () => {
    const fromALaterRelease = 'macros_split' as SetupStep

    expect(resolveSetupResumeTarget(null)).toEqual({route: Screens.MEAL_PLAN_GOAL, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget(fromALaterRelease)).toEqual({
      route: Screens.MEAL_PLAN_GOAL,
      params: {mode: 'setup'}
    })
  })

  it('hands each caller its own params object, so an adjusted one cannot rewrite the next resume', () => {
    const first = resolveSetupResumeTarget('goal')
    const second = resolveSetupResumeTarget('goal')

    expect(first.params).not.toBe(second.params)
  })
})

describe('resolveSetupResumeTarget, with the saved status', () => {
  // The status is the stronger claim: it says every step of the chosen route is answered and only Review is
  // left. A `ready_for_review` row whose `setupStep` this client reads as null would otherwise resolve to the
  // first question, restarting a setup the user had finished.
  it('opens Review for a status of ready_for_review, whatever the step says', () => {
    expect(resolveSetupResumeTarget(null, 'ready_for_review')).toEqual({
      route: Screens.MEAL_PLAN_TARGETS,
      params: {mode: 'setup'}
    })
    expect(resolveSetupResumeTarget('goal', 'ready_for_review').route).toBe(Screens.MEAL_PLAN_TARGETS)
    expect(resolveSetupResumeTarget('body', 'ready_for_review').route).toBe(Screens.MEAL_PLAN_TARGETS)
  })

  it('follows the step for a setup still in progress', () => {
    expect(resolveSetupResumeTarget('schedule', 'in_progress').route).toBe(Screens.MEAL_PLAN_SCHEDULE)
    expect(resolveSetupResumeTarget('targets_manual', 'in_progress').route).toBe(Screens.MEAL_PLAN_EDIT_TARGETS)
  })

  it('falls back to the first step for a status that is not a resumable one', () => {
    expect(resolveSetupResumeTarget(null, 'not_started').route).toBe(Screens.MEAL_PLAN_GOAL)
    expect(resolveSetupResumeTarget(null, 'completed').route).toBe(Screens.MEAL_PLAN_GOAL)
  })

  it('behaves exactly as before when no status is passed', () => {
    expect(resolveSetupResumeTarget('diet')).toEqual(resolveSetupResumeTarget('diet', 'in_progress'))
    expect(resolveSetupResumeTarget(null).route).toBe(Screens.MEAL_PLAN_GOAL)
  })
})
