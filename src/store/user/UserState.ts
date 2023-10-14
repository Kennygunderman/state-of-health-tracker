import Account from './models/Account';
import { AuthError } from './models/AuthError';
import AuthStatus from './models/AuthStatus';

export interface UserState {
    account?: Account;
    authError?: AuthError;
    lastDataSync: number;
    authStatus: AuthStatus;
}
