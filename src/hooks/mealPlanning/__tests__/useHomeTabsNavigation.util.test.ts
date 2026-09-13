import {TargetsReturn} from '@navigation/types'

import Screens from '@constants/screens'

import {buildTabReturnActions, TabReturnAction} from '../useHomeTabsNavigation.util'

const REVIEW_RETURN: TargetsReturn = {kind: 'stack', route: 'review'}
const SETTINGS_RETURN: TargetsReturn = {kind: 'stack', route: 'settings'}
const DIET_RETURN: TargetsReturn = {kind: 'stack', route: 'diet'}
const ACCOUNT_RETURN: TargetsReturn = {kind: 'tab', tab: 'Account'}
const PROGRESS_RETURN: TargetsReturn = {kind: 'tab', tab: 'ProgressStack'}
const MACROS_RETURN: TargetsReturn = {kind: 'tab', tab: 'MacrosStack'}

const POP_TO_TOP: TabReturnAction = {target: 'stack', kind: 'popToTop'}

describe('buildTabReturnActions', () => {
  describe('stack returns', () => {
    it('pops back to the targets review screen for the review route', () => {
      const expected: TabReturnAction[] = [{target: 'stack', kind: 'popTo', route: Screens.MEAL_PLAN_TARGETS}]

      expect(buildTabReturnActions(REVIEW_RETURN)).toStrictEqual(expected)
    })

    it('pops back to plan settings for the settings route', () => {
      const expected: TabReturnAction[] = [{target: 'stack', kind: 'popTo', route: Screens.PLAN_SETTINGS}]

      expect(buildTabReturnActions(SETTINGS_RETURN)).toStrictEqual(expected)
    })

    it('carries no params on either popTo, leaving the retained screen holding its own', () => {
      const [review] = buildTabReturnActions(REVIEW_RETURN)
      const [settings] = buildTabReturnActions(SETTINGS_RETURN)

      expect(review).not.toHaveProperty('params')
      expect(settings).not.toHaveProperty('params')
    })

    it('continues forward to Meal Plan Diet with its setup-mode params for the manual route', () => {
      const expected: TabReturnAction[] = [
        {target: 'stack', kind: 'navigate', route: Screens.MEAL_PLAN_DIET, params: {mode: 'setup'}}
      ]

      expect(buildTabReturnActions(DIET_RETURN)).toStrictEqual(expected)
    })

    // The asymmetry is deliberate: Diet sits ahead of the editor on the stack, so it is pushed rather
    // than popped to, and a pushed step screen must be given the StepMode its route declares.
    it('navigates rather than pops to Diet, and carries the StepMode the route requires', () => {
      const [action] = buildTabReturnActions(DIET_RETURN)

      expect(action.kind).toBe('navigate')
      expect(action.kind).not.toBe('popTo')
      expect(action).toHaveProperty('params', {mode: 'setup'})
    })
  })

  describe('tab returns', () => {
    it('pops the stack to its top before navigating the parent to Account', () => {
      const expected: TabReturnAction[] = [POP_TO_TOP, {target: 'parent', kind: 'navigate', tab: Screens.ACCOUNT}]

      expect(buildTabReturnActions(ACCOUNT_RETURN)).toStrictEqual(expected)
      expect(buildTabReturnActions(ACCOUNT_RETURN)).toHaveLength(2)
    })

    it('pops the stack to its top before navigating the parent to ProgressStack', () => {
      const expected: TabReturnAction[] = [POP_TO_TOP, {target: 'parent', kind: 'navigate', tab: 'ProgressStack'}]

      expect(buildTabReturnActions(PROGRESS_RETURN)).toStrictEqual(expected)
      expect(buildTabReturnActions(PROGRESS_RETURN)).toHaveLength(2)
    })

    it('names no nested screen for ProgressStack, so its retained inner screen resumes', () => {
      const [, action] = buildTabReturnActions(PROGRESS_RETURN)

      expect(action).not.toHaveProperty('params')
    })

    it('needs only the popToTop for the MacrosStack entry point', () => {
      const expected: TabReturnAction[] = [POP_TO_TOP]

      expect(buildTabReturnActions(MACROS_RETURN)).toStrictEqual(expected)
    })
  })

  describe('dispatch order', () => {
    it('puts the popToTop first for every tab return', () => {
      const tabReturns: TargetsReturn[] = [ACCOUNT_RETURN, PROGRESS_RETURN, MACROS_RETURN]

      tabReturns.forEach(returnTo => {
        expect(buildTabReturnActions(returnTo)[0]).toStrictEqual(POP_TO_TOP)
      })
    })
  })

  describe('purity', () => {
    it('returns equal actions for repeated calls with the same return descriptor', () => {
      expect(buildTabReturnActions(DIET_RETURN)).toStrictEqual(buildTabReturnActions(DIET_RETURN))
      expect(buildTabReturnActions(PROGRESS_RETURN)).toStrictEqual(buildTabReturnActions(PROGRESS_RETURN))
    })

    it('is unaffected by a caller mutating a returned array', () => {
      const actions = buildTabReturnActions(PROGRESS_RETURN)

      actions.pop()

      expect(actions).toHaveLength(1)
      expect(buildTabReturnActions(PROGRESS_RETURN)).toHaveLength(2)
    })
  })
})
