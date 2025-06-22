import User from '../../data/models/User';
import { AuthError, AuthErrorPathEnum } from './models/AuthError';
import AuthStatus from './models/AuthStatus';
import { DELETE_ACCOUNT_ERROR, LOGOUT_ACCOUNT_ERROR } from '../../constants/Strings';
import authService from '../../service/auth/AuthService';
import { decodeAuthError } from '../../service/auth/AuthErrorEnum';
import userService from '../../service/user/UserService';
import CrashUtility from '../../utility/CrashUtility';
import { isDateOlderThanADay } from '../../utility/DateUtility';
import { setMealEntriesSynced } from '../dailyMealEntries/DailyMealEntriesActions';
import LocalStore from '../LocalStore';
import { removeUserId, storeUserId } from "../../service/auth/userStorage";

export const SET_USER_ACCOUNT: string = 'SET_USER_ACCOUNT';
export const SET_AUTH_ERROR: string = 'SET_AUTH_ERROR';
export const LOG_IN_USER: string = 'LOG_IN_USER';
export const LOG_OUT_USER: string = 'LOG_OUT_USER';
export const SET_AUTH_STATUS: string = 'SET_AUTH_STATUS';
export const UPDATE_LAST_SYNCED: string = 'UPDATE_LAST_SYNCED';

export function setAuthStatus(authStatus: AuthStatus) {
    return {
        payload: authStatus,
        type: SET_AUTH_STATUS,
    };
}

function setUserAccount(account: User) {
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

export function deleteLoggedInUser() {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch(setAuthStatus(AuthStatus.SYNCING));
        authService.deleteUser(() => {
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
                dispatch(updateLastSynced(Date.now()));
            },
            (error) => {
                CrashUtility.recordError(Error(error));
            },
        );
    };
}
