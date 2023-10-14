import AuthStatus from './models/AuthStatus';
import { UserState } from './UserState';

export const USER_INITIAL_STATE: UserState = {
    lastDataSync: 0,
    authStatus: AuthStatus.LOGGED_OUT,
};
