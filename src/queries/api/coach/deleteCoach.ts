import {httpDelete} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {CoachActionResponse} from './decoder/CoachDecoder'

export async function deleteCoach(): Promise<void> {
  try {
    const response = await httpDelete(Endpoints.Coach, CoachActionResponse)

    if (response?.status !== 200) {
      throw new Error(`Unexpected response deleting coach profile: status=${response?.status}`)
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
