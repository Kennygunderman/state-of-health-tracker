import {create} from 'zustand'

import {getCurrentDate, getCurrentDateISO} from '../../utility/DateUtility'

type SessionStore = {
  sessionStartDate: string
  sessionStartDateIso: string
  hasSeenRunsBetaWarning: boolean
  setHasSeenRunsBetaWarning: (seen: boolean) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionStartDate: getCurrentDate(),
  sessionStartDateIso: getCurrentDateISO(),
  hasSeenRunsBetaWarning: false,
  setHasSeenRunsBetaWarning: (seen: boolean) =>
    set({ hasSeenRunsBetaWarning: seen }),
}))
