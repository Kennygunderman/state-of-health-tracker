import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth'

import User, {CreateUserPayload} from '@data/models/User'
import {AuthErrorPathEnum} from '@store/user/models/AuthError'

import {decodeAuthError} from './AuthErrorEnum'
import {createUser} from './createUser'

class AuthService {
  async registerUser(email: string, password: string): Promise<User> {
    let registeredUser: CreateUserPayload = {
      userId: '',
      email: ''
    }
    try {
      const {user} = await auth().createUserWithEmailAndPassword(email, password)
      registeredUser = {
        userId: user.uid,
        email: user.email ?? ''
      }
    } catch (e) {
      const error = e as FirebaseAuthTypes.NativeFirebaseAuthError
      throw {
        errorPath: AuthErrorPathEnum.REGISTRATION,
        errorDate: Date.now(),
        errorCode: error.code,
        errorMessage: decodeAuthError(error.code)
      }
    }

    try {
      await createUser(registeredUser)

      return {
        id: registeredUser.userId,
        email: registeredUser.email
      }
    } catch (error) {
      console.log(error)
      await this.deleteCurrentUser()
      throw error
    }
  }

  async logInUser(email: string, password: string): Promise<User> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password)
      const {user} = userCredential
      return {
        id: user.uid,
        name: user.displayName,
        email: user.email ?? ''
      }
    } catch (e) {
      const error = e as FirebaseAuthTypes.NativeFirebaseAuthError
      throw {
        errorPath: AuthErrorPathEnum.LOGIN,
        errorDate: Date.now(),
        errorCode: error.code,
        errorMessage: decodeAuthError(error.code)
      }
    }
  }

  getCurrentUser() {
    return auth().currentUser
  }

  async logOutUser() {
    await auth().signOut()
  }

  async deleteCurrentUser() {
    await auth().currentUser?.delete()
  }
}

const authService = new AuthService()
export default authService
