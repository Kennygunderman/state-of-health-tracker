import {MacroTargets} from '@data/models/Macros'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

import {MacroTargetsResponse} from './decoder/MacrosDecoder'

export interface UpdateMacroTargetsPayload {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export async function updateMacroTargets(payload: UpdateMacroTargetsPayload): Promise<MacroTargets> {
  try {
    const response = await httpPut(Endpoints.MacroTargets, MacroTargetsResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response updating macro targets: status=${response?.status}`)
    }

    return response.data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
