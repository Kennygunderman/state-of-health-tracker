import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {CoachActionResponse} from './decoder/CoachDecoder'

export async function ackCheckIn(planId: string): Promise<void> {
  try {
    const response = await httpPost(Endpoints.CoachCheckInAck(planId), CoachActionResponse, {})

    if (response?.status !== 200) {
      throw new Error(`Unexpected response acknowledging check-in: status=${response?.status}`)
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
