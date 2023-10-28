export enum AuthErrorPathEnum {
    REGISTRATION = 'Registration Failed',
    LOGIN = 'Login Failed',
    LOGOUT = 'Logout Failed',
    DELETE = 'Delete Failed',
}

export interface AuthError {
    errorPath: AuthErrorPathEnum;
    errorDate: number;
    errorCode: string;
    errorMessage: string;
}
