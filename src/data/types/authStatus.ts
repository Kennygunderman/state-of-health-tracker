export const authStatus = {
  Authed: 'authed',
  Unauthed: 'unauthed',
} as const

export type AuthStatus = typeof authStatus[keyof typeof authStatus];
