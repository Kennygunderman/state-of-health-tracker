import auth from '@react-native-firebase/auth'

export const getBearerToken = (forceRefresh: boolean = false) => auth().currentUser?.getIdToken(forceRefresh)
