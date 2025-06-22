export const authStatus = {
  Authed: 'authed',
  Unauthed: 'unauthed',
  Pending: 'pending',
  Syncing: 'syncing',
} as const

export type AuthStatus = typeof authStatus[keyof typeof authStatus];
