import React from 'react'

import MealPlanSetupProvider from '@components/MealPlanSetupProvider'

import MacrosRoutesStack from './MacrosRoutesStack'

// The meal-plan setup draft is provided around the route registrations, not inside a wizard screen:
// the seven steps are separate routes, so a provider mounted on one of them would drop every answer
// the moment the user continued to the next. See the lifecycle note in MealPlanSetupProvider.
const MacrosStack = (): React.JSX.Element => {
  return (
    <MealPlanSetupProvider>
      <MacrosRoutesStack />
    </MealPlanSetupProvider>
  )
}

export default MacrosStack
