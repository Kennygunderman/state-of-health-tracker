import {CoachState, UpdateCoachSettingsPayload} from '@data/models/CoachState'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {CoachStateResponse} from './decoder/CoachDecoder'

export async function updateCoachSettings(payload: UpdateCoachSettingsPayload): Promise<CoachState> {
  try {
    const response = await httpPut(Endpoints.CoachSettings, CoachStateResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response updating coach settings: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
