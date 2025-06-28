import remoteConfig from '@react-native-firebase/remote-config'

// Set default values
remoteConfig().setDefaults({
  minimum_app_version: '1.4.3'
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
