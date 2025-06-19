import Account from './models/Account';
import { AuthError, AuthErrorPathEnum } from './models/AuthError';
import AuthStatus from './models/AuthStatus';
import { DELETE_ACCOUNT_ERROR, LOGOUT_ACCOUNT_ERROR } from '../../constants/Strings';
import accountService from '../../service/auth/AccountService';
import { decodeAuthError } from '../../service/auth/AuthErrorEnum';
import userService from '../../service/user/UserService';
import CrashUtility from '../../utility/CrashUtility';
import { isDateOlderThanADay } from '../../utility/DateUtility';
import { setExerciseEntriesSynced } from '../dailyExerciseEntries/DailyExerciseActions';
import { setMealEntriesSynced } from '../dailyMealEntries/DailyMealEntriesActions';
import LocalStore from '../LocalStore';
import { removeUserId, storeUserId } from "../../service/auth/userStorage";

export const SET_USER_ACCOUNT: string = 'SET_USER_ACCOUNT';
export const SET_AUTH_ERROR: string = 'SET_AUTH_ERROR';
export const LOG_IN_USER: string = 'LOG_OUT_USER';
export const LOG_OUT_USER: string = 'LOG_OUT_USER';
export const SET_AUTH_STATUS: string = 'SET_AUTH_STATUS';
export const UPDATE_LAST_SYNCED: string = 'UPDATE_LAST_SYNCED';

export function setAuthStatus(authStatus: AuthStatus) {
    return {
        payload: authStatus,
        type: SET_AUTH_STATUS,
    };
}

function setUserAccount(account: Account) {
    return {
        payload: account,
        type: SET_USER_ACCOUNT,
    };
}

function setAuthError(authError?: AuthError) {
    return {
        payload: authError,
        type: SET_AUTH_ERROR,
    };
}

export function updateLastSynced(date: number) {
    return {
        payload: date,
        type: UPDATE_LAST_SYNCED,
    };
}

// When a user is registered, all guest data should be synced to their new account.
export function registerUser(email: string, password: string) {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch(setAuthStatus(AuthStatus.SYNCING));
        accountService.registerUser(
            email,
            password,
            (account) => {
                userService.saveUserData(
                    account,
                    getState(),
                    () => {
                        dispatch(setAuthStatus(AuthStatus.LOGGED_IN));
                        dispatch(setUserAccount(account));
                        dispatch(setAuthError(undefined));
                        dispatch(setMealEntriesSynced());
                        dispatch(setExerciseEntriesSynced());
                    },
                    (error) => {
                        // If this error happens, the user has registered but their account data is not synced to the server.
                        CrashUtility.recordError(Error(error));

                        dispatch(setUserAccount(account));
                        dispatch(setAuthStatus(AuthStatus.LOGGED_IN));
                    },
                );
            },
            (error) => {
                dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
                dispatch(setAuthError(error));
            },
        );
    };
}

// When a user logs in, all guest data should be overwritten by the logged-in users account data.
export function logInUser(email: string, password: string) {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch(setAuthStatus(AuthStatus.SYNCING));
        removeUserId();
        accountService.logInUser(
            email,
            password,
            (account) => {
                userService.fetchUserData(
                    account.id,
                    (data: LocalStore) => {
                        dispatch({
                            payload: data,
                            type: LOG_IN_USER,
                        });
                        dispatch(setUserAccount(account));
                        dispatch(setAuthError(undefined));
                        dispatch(setAuthStatus(AuthStatus.LOGGED_IN));
                        storeUserId(account.id)
                    },
                    (error) => {
                        // If this error happens, the user was able to log in with the auth service, but their data
                        // could not be fetched from the server. In this case, log the user out.
                        CrashUtility.recordError(Error(error));
                        dispatch(setAuthError({
                            errorPath: AuthErrorPathEnum.LOGIN,
                            errorMessage: decodeAuthError(error),
                            errorDate: Date.now(),
                            errorCode: error,
                        }));
                        dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
                    },
                );
            },
            (error) => {
                dispatch(setAuthError(error));
                dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
            },
        );
    };
}

// When a user logs out, all account data should be synced to server, and local state should be wiped fresh.
export function logOutUser(account: Account) {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch(setAuthStatus(AuthStatus.SYNCING));
        userService.saveUserData(
            account,
            getState(),
            () => {
                accountService.logOutUser();
                dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
                dispatch({
                    type: LOG_OUT_USER, // Logout is handled in the root reducer
                });
                removeUserId();
            },
            (error) => {
                // If this error happens, cancel user logout to prevent data loss.
                CrashUtility.recordError(Error(error));
                dispatch(setAuthError({
                    errorPath: AuthErrorPathEnum.LOGOUT,
                    errorMessage: LOGOUT_ACCOUNT_ERROR,
                    errorDate: Date.now(),
                    errorCode: error,
                }));
                dispatch(setAuthStatus(AuthStatus.LOGGED_IN));
            },
        );
    };
}

export function deleteLoggedInUser() {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch(setAuthStatus(AuthStatus.SYNCING));
        accountService.deleteUser(() => {
            dispatch(setAuthStatus(AuthStatus.LOGGED_OUT));
            dispatch({
                type: LOG_OUT_USER, // Logout is handled in the root reducer
            });
        }, (error) => {
            CrashUtility.recordError(Error(`${error}`));
            dispatch(setAuthError({
                errorPath: AuthErrorPathEnum.DELETE,
                errorMessage: DELETE_ACCOUNT_ERROR,
                errorDate: Date.now(),
                errorCode: '',
            }));
            dispatch(setAuthStatus(AuthStatus.LOGGED_IN));
        });
    };
}

export function syncUserData() {
    return async (dispatch: any, getState: () => LocalStore) => {
        // only sync logged-in users if last data sync was > 1 day ago.
        const { user } = getState();
        if (!user.account || user.authStatus === 'LOGGED_OUT' || !isDateOlderThanADay(user.lastDataSync ?? 0)) {
            return;
        }

        await userService.saveUserData(
            user.account,
            getState(),
            () => {
                dispatch(setMealEntriesSynced());
                dispatch(setExerciseEntriesSynced());
                dispatch(updateLastSynced(Date.now()));
            },
            (error) => {
                CrashUtility.recordError(Error(error));
            },
        );
    };
}
