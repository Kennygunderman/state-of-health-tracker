import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { decodeAuthError } from './AuthErrorEnum';
import Account from '../../store/user/models/Account';
import { AuthErrorPathEnum } from '../../store/user/models/AuthError';

class AuthService {
  async registerUser(email: string, password: string): Promise<Account> {

    try {
      const { user } = await auth().createUserWithEmailAndPassword(email, password);
      return {
        id: user.uid,
        name: user.displayName,
        email: user.email,
      }
    } catch (e) {
      const error = e as FirebaseAuthTypes.NativeFirebaseAuthError;
      throw {
        errorPath: AuthErrorPathEnum.REGISTRATION,
        errorDate: Date.now(),
        errorCode: error.code,
        errorMessage: decodeAuthError(error.code),
      }
    }
  }

  async logInUser(email: string, password: string): Promise<Account> {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const { user } = userCredential;
      return {
        id: user.uid,
        name: user.displayName,
        email: user.email,
      };
    } catch (e) {
      const error = e as FirebaseAuthTypes.NativeFirebaseAuthError;
      throw {
        errorPath: AuthErrorPathEnum.LOGIN,
        errorDate: Date.now(),
        errorCode: error.code,
        errorMessage: decodeAuthError(error.code),
      };
    }
  }

  getCurrentUser() {
    return auth().currentUser;
  }

  async logOutUser() {
    await auth().signOut();
  }

  async deleteCurrentUser() {
    await auth().currentUser?.delete()
  }
}

const authService = new AuthService();
export default authService;
