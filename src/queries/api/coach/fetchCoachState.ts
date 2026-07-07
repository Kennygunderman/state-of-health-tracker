import {CoachState} from '@data/models/CoachState'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {CoachStateResponse} from './decoder/CoachDecoder'

export async function fetchCoachState(): Promise<CoachState> {
  try {
    const response = await httpGet(Endpoints.CoachState, CoachStateResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching coach state: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
