export enum AuthErrorEnum {
  EMAIL_IN_USE = 'auth/email-already-in-use',
  INVALID_CREDENTIALS = 'auth/invalid-credential',
  TOO_MANY_REQUESTS = 'auth/too-many-requests'
}

export const decodeAuthError = (errorCode: string) => {
  switch (errorCode) {
    case AuthErrorEnum.EMAIL_IN_USE:
      return 'This email is already in use'
    case AuthErrorEnum.INVALID_CREDENTIALS:
      return 'Incorrect email or password'
    case AuthErrorEnum.TOO_MANY_REQUESTS:
      return 'Too many login attempts. Please try again in a few minutes.'
    default:
      return 'an unknown error occurred, please check your connection and try again in a few minutes'
  }
}
