import {HomeTabsParamList} from '@navigation/HomeTabs'
import {RootStackParamList, TargetsReturn} from '@navigation/types'

import Screens from '@constants/screens'

type StackReturnRoute = Extract<TargetsReturn, {kind: 'stack'}>['route']

type ReturnTab = Extract<TargetsReturn, {kind: 'tab'}>['tab']

// `Extract` proves every tab a `TargetsReturn` can name is registered in `HomeTabs`. No params member
// exists because a nested screen param would reset the target tab's own stack, and the tab return has to
// resume the screen that tab retained.
type ParentNavigateAction = {target: 'parent'; kind: 'navigate'; tab: Extract<keyof HomeTabsParamList, ReturnTab>}

// Mapped over the param list so a route and its params stay correlated. `popTo` params are optional
// because the target screen is already on the stack holding its own, and v7 `popTo` params replace them:
// `TargetsReturn` carries no honest source for the review screen's `StepMode` or Plan Settings' `planId`,
// so synthesising either would corrupt the screen being returned to.
type StackPopToAction = {
  [Route in keyof RootStackParamList]: {
    target: 'stack'
    kind: 'popTo'
    route: Route
    params?: RootStackParamList[Route]
  }
}[keyof RootStackParamList]

type StackNavigateAction = {
  [Route in keyof RootStackParamList]: {
    target: 'stack'
    kind: 'navigate'
    route: Route
    params: RootStackParamList[Route]
  }
}[keyof RootStackParamList]

/**
 * `target` names the navigator an action is dispatched against: `'stack'` is the MacrosStack navigation
 * object, `'parent'` is the tab navigator reached through it.
 */
export type TabReturnAction =
  | {target: 'stack'; kind: 'popToTop'}
  | StackPopToAction
  | StackNavigateAction
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
      // on the stack rather than behind it, and it resumes the setup run the skipped step belonged to.
      return [{target: 'stack', kind: 'navigate', route: Screens.MEAL_PLAN_DIET, params: {mode: 'setup'}}]
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
      // Named without a nested screen so Progress resumes whichever of its screens the user left, rather
      // than being reset to the tab's initial route.
      return [
        {target: 'stack', kind: 'popToTop'},
        {target: 'parent', kind: 'navigate', tab: 'ProgressStack'}
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
