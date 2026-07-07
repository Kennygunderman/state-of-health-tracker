import {useEffect} from 'react'

import {useSyncProfileMutation} from '@queries/user/useSyncProfileMutation'
import useAuthStore from '@store/auth/useAuthStore'
import useUserData from '@store/userData/useUserData'

const getDeviceTimezone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

// Headless: pushes the device timezone + weight unit to the server on login so
// the Coach engine can bucket days correctly and interpret legacy weigh-ins
// (tdee-coach-plan.md §3.5). Fire-and-forget — sync failures are invisible to
// the user and retried on the next launch.
const ProfileSync = () => {
  const isAuthed = useAuthStore(state => state.isAuthed)
  const weightUnit = useUserData(state => state.weightUnit)
  const {mutate: syncProfile} = useSyncProfileMutation()

  useEffect(() => {
    if (!isAuthed) return

    syncProfile({timezone: getDeviceTimezone(), weightUnit})
  }, [isAuthed, weightUnit, syncProfile])

  return null
}

export default ProfileSync
