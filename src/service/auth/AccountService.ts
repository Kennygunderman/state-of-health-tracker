import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { decodeAuthError } from './AuthErrorEnum';
import Account from '../../store/user/models/Account';
import { AuthError, AuthErrorPathEnum } from '../../store/user/models/AuthError';
import CrashUtility from '../../utility/CrashUtility';

class AccountService {
    registerUser(email: string, password: string, onCreated: (account: Account) => void, onError: (authError: AuthError) => void) {
        auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const { user } = userCredential;
                onCreated({
                    id: user.uid,
                    name: user.displayName,
                    email: user.email,
                });
            })
            .catch((error) => {
                CrashUtility.recordError(error);
                onError({
                    errorPath: AuthErrorPathEnum.REGISTRATION,
                    errorDate: Date.now(),
                    errorCode: error.code,
                    errorMessage: decodeAuthError(error.code),
                });
            });
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
            const authError: AuthError = {
                errorPath: AuthErrorPathEnum.LOGIN,
                errorDate: Date.now(),
                errorCode: error.code,
                errorMessage: decodeAuthError(error.code),
            };

            return Promise.reject(authError);
        }
    }
    logOutUser() {
        auth().signOut();
    }

    deleteUser(onDeleted: () => void, onError: (error: Error) => void) {
        auth().currentUser?.delete()
            .then(() => {
                onDeleted();
            })
            .catch((e) => {
                onError(Error(e));
            });
    }
}

const accountService = new AccountService();
export default accountService;
