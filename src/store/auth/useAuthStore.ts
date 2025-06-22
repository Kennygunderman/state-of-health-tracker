import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { authStatus, AuthStatus } from "../../data/types/authStatus";
import auth from "@react-native-firebase/auth";
import accountService from "../../service/auth/AccountService";
import userService from "../../service/user/UserService";
import LocalStore from "../LocalStore";
import { storeUserId } from "../../service/auth/userStorage";
import CrashUtility from "../../utility/CrashUtility";
import { AuthError, AuthErrorPathEnum } from "../user/models/AuthError";
import { decodeAuthError } from "../../service/auth/AuthErrorEnum";
import { LOG_IN_USER } from "../user/UserActions";
import { AuthErrorSubject$ } from "../../navigation/HomeTabs";

export type AuthState = {
  userId: string | null;
  userEmail: string | null;
  authStatus: AuthStatus | null;
  initAuth: () => void;
  // passing in dispatch here is a temp workaround while I
  // remove redux from the app
  loginUser: (email: string, password: string, dispatch: Function) => void;
};

const useAuthStore = create<AuthState>()(
  immer((set) => ({
    userId: null,
    userEmail: null,
    authStatus: null,
    initAuth: () => {
      const user = auth().currentUser;
      set({
        userId: user?.uid,
        userEmail: user?.email || null,
        authStatus: user?.uid ? authStatus.Authed : authStatus.Unauthed
      });
    },
    loginUser: async (email, password, dispatch) => {
      try {
        const account = await accountService.logInUser(email, password);
        const data = await userService.fetchUserData(account.id);

        // this god awful implementation will be removed once redux is gone
        // and everything is fully migrated to postgres
        dispatch({
          payload: data,
          type: LOG_IN_USER,
        });

        set({
          userEmail: account.email,
          authStatus: authStatus.Authed
        })
      } catch (error: any) {
        const code = error?.code || error?.errorCode || 'unknown'
        const authError: AuthError = {
          errorPath: AuthErrorPathEnum.LOGIN,
          errorMessage: decodeAuthError(code),
          errorDate: Date.now(),
          errorCode: code,
        }

        AuthErrorSubject$.next(authError);
        set({ authStatus: authStatus.Unauthed });
      }
    }
  }))
);

export default useAuthStore;
