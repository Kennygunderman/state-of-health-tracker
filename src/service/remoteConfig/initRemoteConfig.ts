import remoteConfig from '@react-native-firebase/remote-config'
import {MealPlanningFlagInputs, resolveMealPlanningFlagEnabled} from '@utility/MealPlanEntitlementUtility'

remoteConfig().setDefaults({
  minimum_app_version: '1.4.3',
  // Kill switch for all AI logging (estimate + label scan). Flip to false in
  // the Firebase console to hide the feature; the backend AI_FEATURES_ENABLED
  // env var is the authoritative server-side switch.
  log_with_ai_enabled: true,
  // Defaults to false, unlike the flag above: a never-fetched or offline
  // install must hide meal planning rather than show it unseeded. The backend
  // MEAL_PLANNING_ENABLED env var is the second gate.
  meal_planning_enabled: false
})

remoteConfig().setConfigSettings({
  minimumFetchIntervalMillis: 900_000 // 15 min
})

export const initRemoteConfig = async () => {
  return await remoteConfig().fetchAndActivate()
}

export const getMinimumAppVersion = () => {
  return remoteConfig().getValue('minimum_app_version').asString()
}

export const isLogWithAiEnabled = () => {
  return remoteConfig().getValue('log_with_ai_enabled').asBoolean()
}

// The source and fetch status are read alongside the value because asBoolean() alone cannot separate a
// never-activated packaged default from an activated console value, which is what the fail-closed policy in
// resolveMealPlanningFlagEnabled turns on. That policy lives in one place only; this reads its inputs.
const readMealPlanningFlag = (): MealPlanningFlagInputs => {
  const value = remoteConfig().getValue('meal_planning_enabled')

  return {lastFetchStatus: remoteConfig().lastFetchStatus, valueSource: value.getSource(), value: value.asBoolean()}
}

export const isMealPlanningEnabled = (): boolean => resolveMealPlanningFlagEnabled(readMealPlanningFlag())
