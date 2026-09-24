import {useCallback} from 'react'

import {SetupStatus, SetupStep} from '@data/models/MealPlanPreferences'
import {Navigation} from '@navigation/types'
import {ParamListBase, useNavigation} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'
import {resolveSetupResumeTarget} from '@utility/MealPlanSetupResumeUtility'

export interface SetupResumeNavigation {
  resumeSetup: (step: SetupStep | null, status?: SetupStatus) => void
}

/**
 * Opening the setup step a user left off at, from the only surface that offers to continue: the Meal Plan
 * tab's no-plan state. Returning users never see the introduction, so it holds no resume path (AAP 0.7.4).
 *
 * The dispatch lives in one hook because route and params arrive already correlated from
 * `resolveSetupResumeTarget`, and the runtime navigation object takes that pair as it stands rather than
 * re-deriving the pairing — the same two-step form `useHomeTabsNavigation` uses for its cross-tab returns.
 */
export const useSetupResumeNavigation = (): SetupResumeNavigation => {
  const navigation = useNavigation<Navigation>()

  const resumeSetup = useCallback(
    (step: SetupStep | null, status?: SetupStatus): void => {
      const target = resolveSetupResumeTarget(step, status)
      const stack: NativeStackNavigationProp<ParamListBase> = navigation

      stack.navigate<string>(target.route, target.params)
    },
    [navigation]
  )

  return {resumeSetup}
}
