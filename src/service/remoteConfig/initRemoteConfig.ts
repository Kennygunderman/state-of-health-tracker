import remoteConfig from '@react-native-firebase/remote-config'

remoteConfig().setDefaults({
  minimum_app_version: '1.4.3',
  // Kill switch for all AI logging (estimate + label scan). Flip to false in
  // the Firebase console to hide the feature; the backend AI_FEATURES_ENABLED
  // env var is the authoritative server-side switch.
  log_with_ai_enabled: true,
  // Kill switch for the Coach (adaptive TDEE) surfaces — the expenditure card
  // now, enrollment/weekly plans in later phases.
  coach_enabled: true
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

export const isCoachEnabled = () => {
  return remoteConfig().getValue('coach_enabled').asBoolean()
}
