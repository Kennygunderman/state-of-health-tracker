import { AuthStatus } from "./authStatus";
import { AuthError } from "../../store/user/models/AuthError";

export const authEventType = {
  Status: 0,
  Error: 1,
} as const;

export type AuthEvent =
  | { type: typeof authEventType.Status; status: AuthStatus }
  | { type: typeof authEventType.Error; error: AuthError };
