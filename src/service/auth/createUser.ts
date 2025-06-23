import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import {CreateUserPayload} from '../../data/models/User'
import CrashUtility from '../../utility/CrashUtility'
import {httpPost} from '../http/httpUtil'

const VoidResponse = io.unknown

export async function createUser(payload: CreateUserPayload): Promise<boolean> {
  try {
    const response = await httpPost(Endpoints.User, VoidResponse, payload, {useUserId: false})

    if (!response || response.status !== 201 || !response.data) {
      throw new Error('Invalid response when creating user response: ' + JSON.stringify(response))
    }

    return true
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
