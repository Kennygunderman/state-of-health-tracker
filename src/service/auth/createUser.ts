import {CreateUserPayload} from '@data/models/User'
import {httpPost} from '@service/http/httpUtil'
import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import CrashUtility from '../../utility/CrashUtility'

const VoidResponse = io.unknown

export async function createUser(payload: CreateUserPayload): Promise<boolean> {
  try {
    const response = await httpPost(Endpoints.User, VoidResponse, payload, {useAuth: false})

    if (!response || response.status !== 201 || !response.data) {
      throw new Error('Invalid response when creating user response: ' + JSON.stringify(response))
    }

    return true
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
