import remoteConfig from '@react-native-firebase/remote-config'

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

export const isMealPlanningEnabled = (): boolean => {
  return remoteConfig().getValue('meal_planning_enabled').asBoolean()
}
