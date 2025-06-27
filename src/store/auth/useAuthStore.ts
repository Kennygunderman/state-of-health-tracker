import {authEventType} from '@data/types/authEvent'
import {authStatus} from '@data/types/authStatus'
import {decodeAuthError} from '@service/auth/AuthErrorEnum'
import authService from '@service/auth/AuthService'
import userService from '@service/user/UserService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import LocalStore from '@store/LocalStore'
import {AuthError, AuthErrorPathEnum} from '@store/user/models/AuthError'
import {LOG_IN_USER, LOG_OUT_USER} from '@store/user/UserActions'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'

import {AuthSubject$} from '@screens/Auth'

export type AuthState = {
  userId: string | null
  userEmail: string | null
  isAuthed: boolean
  isAttemptingAuth: boolean
  initAuth: () => void
  // passing in dispatch here is a temp workaround while I remove redux from the app
  loginUser: (email: string, password: string, dispatch: Function) => void
  registerUser: (email: string, password: string) => void

  // passing in dispatch here is a temp workaround while I remove redux from the app
  logoutUser: (dispatch: Function, state: LocalStore) => void
  deleteUser: () => void
}

const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    userId: null,
    userEmail: null,
    isAuthed: false,
    isAttemptingAuth: false,
    initAuth: () => {
      const user = authService.getCurrentUser()
      const isAuthed = user !== null
      const userId = user?.uid

      set({
        userId,
        userEmail: user?.email || null,
        isAuthed: isAuthed
      })

      AuthSubject$.next({
        type: authEventType.Status,
        status: isAuthed ? authStatus.Authed : authStatus.Unauthed
      })
    },
    loginUser: async (email, password, dispatch) => {
      set({isAttemptingAuth: true})
      try {
        const user = await authService.logInUser(email, password)

        // this god awful implementation will be removed once redux is gone
        // and everything is fully migrated to postgres
        const data = await userService.fetchUserData(user.id)

        dispatch({
          payload: data,
          type: LOG_IN_USER
        })

        set({
          userEmail: user.email,
          isAuthed: true
        })

        AuthSubject$.next({
          type: authEventType.Status,
          status: authStatus.Authed
        })
      } catch (error: any) {
        const code = error?.code || error?.errorCode || 'unknown'
        const authError: AuthError = {
          errorPath: AuthErrorPathEnum.LOGIN,
          errorMessage: decodeAuthError(code),
          errorDate: Date.now(),
          errorCode: code
        }

        AuthSubject$.next({
          type: authEventType.Error,
          error: authError
        })

        set({isAuthed: false})
      } finally {
        set({isAttemptingAuth: false})
      }
    },
    registerUser: async (email, password) => {
      set({isAttemptingAuth: true})
      try {
        const account = await authService.registerUser(email, password)

        set({
          userEmail: account.email,
          isAuthed: true
        })

        AuthSubject$.next({
          type: authEventType.Status,
          status: authStatus.Authed
        })
      } catch (error: any) {
        const code = error?.code || error?.errorCode || 'unknown'
        const authError: AuthError = {
          errorPath: AuthErrorPathEnum.LOGIN,
          errorMessage: decodeAuthError(code),
          errorDate: Date.now(),
          errorCode: code
        }

        AuthSubject$.next({
          type: authEventType.Error,
          error: authError
        })

        set({isAuthed: false})
      } finally {
        set({isAttemptingAuth: false})
      }
    },
    logoutUser: async (dispatch: Function, state: LocalStore) => {
      // this is a temp workaround while I remove redux from the app
      const {userId} = get()

      if (userId) await userService.saveUserData(userId, state)
      dispatch({
        type: LOG_OUT_USER
      })

      await authService.logOutUser()
      await offlineWorkoutStorageService.clear()
      //TODO: reset other zustand stores (exercises, workouts, etc.)

      set({
        userId: null,
        userEmail: null,
        isAuthed: false
      })
    },
    deleteUser: async () => {
      await authService.deleteCurrentUser()
      await offlineWorkoutStorageService.clear()
      //TODO: reset other zustand stores (exercises, workouts, etc.)

      set({
        userId: null,
        userEmail: null,
        isAuthed: false
      })
    }
  }))
)

export default useAuthStore
