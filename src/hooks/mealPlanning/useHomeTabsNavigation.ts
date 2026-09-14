import {useCallback} from 'react'

import {HomeTabsParamList} from '@navigation/HomeTabs'
import {Navigation, TargetsReturn} from '@navigation/types'
import {NavigationProp, ParamListBase, useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

import {buildTabReturnActions, TabReturnAction} from './useHomeTabsNavigation.util'

type RuntimeRouteStack = NativeStackNavigationProp<ParamListBase>

type RuntimeRouteTabs = NavigationProp<ParamListBase>

const KEEP_TARGET_SCREEN_PARAMS = {merge: true}

const noDispatchFor = (unhandled: never): void => unhandled

const dispatchReturnAction = (
  stack: RuntimeRouteStack,
  parent: RuntimeRouteTabs | undefined,
  action: TabReturnAction
): void => {
  if (action.target === 'parent') {
    // The tab switch follows a stack pop rather than standing alone: a bare tab navigate would leave the
    // targets editor on the MacrosStack, so returning to the Macros tab later would land back on it.
    parent?.navigate<string>(action.tab)

    return
  }

  switch (action.kind) {
    case 'popToTop':
      stack.popToTop()

      return
    case 'popTo':
      stack.popTo<string>(action.route, action.params, KEEP_TARGET_SCREEN_PARAMS)

      return
    case 'navigate':
      stack.navigate<string>(action.route, action.params)

      return
    default:
      return noDispatchFor(action)
  }
}

export interface HomeTabsNavigation {
  returnFromTargets: (returnTo: TargetsReturn) => void
}

/**
 * Leaving the nutrition-targets editor for wherever it was opened from. A return that crosses tabs takes two
 * steps — the MacrosStack pops and then the parent tab navigator switches — dispatched in the order
 * `buildTabReturnActions` lists them.
 */
export const useHomeTabsNavigation = (): HomeTabsNavigation => {
  const navigation = useNavigation<Navigation>()

  const returnFromTargets = useCallback(
    (returnTo: TargetsReturn): void => {
      const parent = navigation.getParent<NavigationProp<HomeTabsParamList> | undefined>()

      buildTabReturnActions(returnTo).forEach(action => dispatchReturnAction(navigation, parent, action))
    },
    [navigation]
  )

  return {returnFromTargets}
}
