import {HomeTabsParamList} from '@navigation/HomeTabs'
import {RootStackParamList, TargetsReturn} from '@navigation/types'

import Screens from '@constants/screens'

type StackReturnRoute = Extract<TargetsReturn, {kind: 'stack'}>['route']

type ReturnTab = Extract<TargetsReturn, {kind: 'tab'}>['tab']

type ParentNavigateAction = {
  [Tab in keyof HomeTabsParamList]: {target: 'parent'; kind: 'navigate'; tab: Tab; params?: HomeTabsParamList[Tab]}
}[keyof HomeTabsParamList]

/**
 * `target` names the navigator an action is dispatched against: `'stack'` is the MacrosStack navigation
 * object, `'parent'` is the tab navigator reached through it.
 */
export type TabReturnAction =
  | {target: 'stack'; kind: 'popToTop'}
  | {target: 'stack'; kind: 'popTo'; route: keyof RootStackParamList}
  | {target: 'stack'; kind: 'navigate'; route: keyof RootStackParamList}
  | ParentNavigateAction

// The `never` parameter turns an unhandled union arm into a compile error, while `[x].slice(0, 0)` keeps
// the unreachable runtime branch on the empty-list contract instead of returning the offending value.
const noActionsFor = (unhandled: never): TabReturnAction[] => [unhandled].slice(0, 0)

const stackReturnActions = (route: StackReturnRoute): TabReturnAction[] => {
  switch (route) {
    case 'review':
      return [{target: 'stack', kind: 'popTo', route: Screens.MEAL_PLAN_TARGETS}]
    case 'settings':
      return [{target: 'stack', kind: 'popTo', route: Screens.PLAN_SETTINGS}]
    case 'diet':
      // The manual-target route carries on forward through the wizard, so Diet sits ahead of the editor
      // on the stack rather than behind it.
      return [{target: 'stack', kind: 'navigate', route: Screens.MEAL_PLAN_DIET}]
    default:
      return noActionsFor(route)
  }
}

const tabReturnActions = (tab: ReturnTab): TabReturnAction[] => {
  switch (tab) {
    case Screens.ACCOUNT:
      return [
        {target: 'stack', kind: 'popToTop'},
        {target: 'parent', kind: 'navigate', tab: Screens.ACCOUNT}
      ]
    case 'ProgressStack':
      return [
        {target: 'stack', kind: 'popToTop'},
        {target: 'parent', kind: 'navigate', tab: 'ProgressStack', params: {screen: Screens.PROGRESS}}
      ]
    case 'MacrosStack':
      return [{target: 'stack', kind: 'popToTop'}]
    default:
      return noActionsFor(tab)
  }
}

/**
 * Ordered: the caller dispatches the actions in sequence, so the stack has popped before the parent tab
 * navigate runs.
 */
export const buildTabReturnActions = (returnTo: TargetsReturn): TabReturnAction[] => {
  switch (returnTo.kind) {
    case 'stack':
      return stackReturnActions(returnTo.route)
    case 'tab':
      return tabReturnActions(returnTo.tab)
    default:
      return noActionsFor(returnTo)
  }
}
