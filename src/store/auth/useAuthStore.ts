import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { authStatus } from "../../data/types/authStatus";
import auth from "@react-native-firebase/auth";
import accountService from "../../service/auth/AccountService";
import userService from "../../service/user/UserService";
import { AuthError, AuthErrorPathEnum } from "../user/models/AuthError";
import { decodeAuthError } from "../../service/auth/AuthErrorEnum";
import { LOG_IN_USER } from "../user/UserActions";
import { AuthSubject$ } from "../../screens/Auth";
import { authEventType } from "../../data/types/authEvent";

export type AuthState = {
  userId: string | null;
  userEmail: string | null;
  isAuthed: boolean;
  isAttemptingAuth: boolean;
  initAuth: () => void;
  // passing in dispatch here is a temp workaround while I
  // remove redux from the app
  loginUser: (email: string, password: string, dispatch: Function) => void;
};

const useAuthStore = create<AuthState>()(
  immer((set) => ({
    userId: null,
    userEmail: null,
    isAuthed: false,
    isAttemptingAuth: false,
    initAuth: () => {
      const user = auth().currentUser;
      const isAuthed = user !== null;
      set({
        userId: user?.uid,
        userEmail: user?.email || null,
        isAuthed: isAuthed
      });

      AuthSubject$.next({
        type: authEventType.Status,
        status: isAuthed ? authStatus.Authed : authStatus.Unauthed,
      });
    },
    loginUser: async (email, password, dispatch) => {
      set({ isAttemptingAuth: true });
      try {
        const account = await accountService.logInUser(email, password);
        const data = await userService.fetchUserData(account.id);

        // this god awful implementation will be removed once redux is gone
        // and everything is fully migrated to postgres
        dispatch({
          payload: data,
          type: LOG_IN_USER,
        });

        set({ userEmail: account.email, isAuthed: true });

        AuthSubject$.next({
          type: authEventType.Status,
          status: authStatus.Authed
        });
      } catch (error: any) {
        const code = error?.code || error?.errorCode || 'unknown'
        const authError: AuthError = {
          errorPath: AuthErrorPathEnum.LOGIN,
          errorMessage: decodeAuthError(code),
          errorDate: Date.now(),
          errorCode: code,
        }

        AuthSubject$.next({
          type: authEventType.Error,
          error: authError
        });

        set({ isAuthed: false });
      } finally {
        set({ isAttemptingAuth: false });
      }
    }
  }))
);

export default useAuthStore;
