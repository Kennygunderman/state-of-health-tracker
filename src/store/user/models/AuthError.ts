export enum AuthErrorPathEnum {
    REGISTRATION = 'Registration Failed',
    LOGIN = 'Login Failed',
    LOGOUT = 'Logout Failed',
}

export interface AuthError {
    errorPath: AuthErrorPathEnum;
    errorDate: number;
    errorCode: string;
    errorMessage: string;
}
