import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getUserId, removeUserId } from "../../service/auth/userStorage";
import { authStatus, AuthStatus } from "../../data/types/authStatus";

export type AuthState = {
  userId: string | null;
  authStatus: AuthStatus | null;
  initAuth: () => void;
  clearUserId: () => void;
};

const useAuthStore = create<AuthState>()(
  immer((set) => ({
    userId: null,
    authStatus: null,
    initAuth: () => {
      getUserId().then((id) => {
        set({
          userId: id,
          authStatus: id ? authStatus.Authed : authStatus.Unauthed
        });
      })
    },
    clearUserId: () => {
      set({ userId: null, authStatus: authStatus.Unauthed });
      removeUserId();
    },
  }))
);

export default useAuthStore;
