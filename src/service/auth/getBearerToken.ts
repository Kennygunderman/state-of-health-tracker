import auth from '@react-native-firebase/auth'

export const getBearerToken = () => auth().currentUser?.getIdToken()
