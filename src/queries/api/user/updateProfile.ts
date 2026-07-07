import {UpdateProfilePayload, UserProfile} from '@data/models/CoachState'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {UserProfileResponse} from '../coach/decoder/CoachDecoder'

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  try {
    const response = await httpPut(Endpoints.UserProfile, UserProfileResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response updating profile: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
