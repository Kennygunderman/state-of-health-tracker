import User from '../../data/models/User';
import { AuthError } from './models/AuthError';
import AuthStatus from './models/AuthStatus';

export interface UserState {
    account?: User;
    authError?: AuthError;
    lastDataSync: number;
    authStatus: AuthStatus;
}
