import { create } from 'zustand';
import { getCurrentDate, getCurrentDateISO } from "../../utility/DateUtility";

type SessionStore = {
  sessionStartDate: string;
  sessionStartDateIso: string;
};

export const useSessionStore = create<SessionStore>(() => ({
  sessionStartDate: getCurrentDate(),
  sessionStartDateIso: getCurrentDateISO()
}));
