import { USER_INITIAL_STATE } from './initialState';
import Account from './models/Account';
import { AuthError } from './models/AuthError';
import AuthStatus from './models/AuthStatus';
import {
    SET_AUTH_ERROR, SET_AUTH_STATUS, SET_USER_ACCOUNT, UPDATE_LAST_SYNCED,
} from './UserActions';
import { UserState } from './UserState';

function setUserAccount(state: UserState, action: Action<Account>): UserState {
    const account = action.payload;

    if (!account) {
        return state;
    }

    return {
        ...state,
        account,
    };
}

function setAuthError(state: UserState, action: Action<AuthError>): UserState {
    const authError = action.payload;
    return {
        ...state,
        authError,
    };
}

function setAuthStatus(state: UserState, action: Action<AuthStatus>): UserState {
    const authStatus = action.payload;

    if (!authStatus) {
        return state;
    }

    return {
        ...state,
        authStatus,
    };
}

function updateLastSynced(state: UserState, action: Action<number>): UserState {
    const syncedDate = action.payload;

    if (!syncedDate) {
        return state;
    }

    return {
        ...state,
        lastDataSync: syncedDate,
    };
}

const userReducerMap = {
    [SET_USER_ACCOUNT]: setUserAccount,
    [SET_AUTH_ERROR]: setAuthError,
    [SET_AUTH_STATUS]: setAuthStatus,
    [UPDATE_LAST_SYNCED]: updateLastSynced,
};

export function userReducer(state = USER_INITIAL_STATE, action: Action<any>): UserState {
    const reducer = userReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
