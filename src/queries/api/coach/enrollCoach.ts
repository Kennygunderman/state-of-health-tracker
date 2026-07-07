import {CoachState, EnrollCoachPayload} from '@data/models/CoachState'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {CoachStateResponse} from './decoder/CoachDecoder'

export async function enrollCoach(payload: EnrollCoachPayload): Promise<CoachState> {
  try {
    const response = await httpPost(Endpoints.CoachEnroll, CoachStateResponse, payload)

    if ((response?.status !== 200 && response?.status !== 201) || !response.data) {
      throw new Error(`Unexpected response enrolling in coach: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
