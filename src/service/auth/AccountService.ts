import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import { decodeAuthError } from './AuthErrorEnum';
import Account from '../../store/user/models/Account';
import { AuthError, AuthErrorPathEnum } from '../../store/user/models/AuthError';

export interface IAccountService {
    registerUser: (email: string, password: string, onCreated: (account: Account) => void, onError: (authError: AuthError) => void) => void;
    logInUser: (email: string, password: string, onCreated: (account: Account) => void, onError: (authError: AuthError) => void) => void;
    logOutUser: () => void;
    deleteUser: (onDeleted: () => void, onError: (Error: Error) => void) => void;
}

class AccountService implements IAccountService {
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
                crashlytics().recordError(error);
                onError({
                    errorPath: AuthErrorPathEnum.REGISTRATION,
                    errorDate: Date.now(),
                    errorCode: error.code,
                    errorMessage: decodeAuthError(error.code),
                });
            });
    }

    logInUser(email: string, password: string, onCreated: (account: Account) => void, onError: (authError: AuthError) => void) {
        auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const { user } = userCredential;
                onCreated({
                    id: user.uid,
                    name: user.displayName,
                    email: user.email,
                });
            })
            .catch((error) => {
                crashlytics().recordError(error);
                onError({
                    errorPath: AuthErrorPathEnum.LOGIN,
                    errorDate: Date.now(),
                    errorCode: error.code,
                    errorMessage: decodeAuthError(error.code),
                });
            });
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

const accountService = new AccountService() as IAccountService;
export default accountService;
