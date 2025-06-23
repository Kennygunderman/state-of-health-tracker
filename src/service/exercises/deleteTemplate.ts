import {httpDelete} from '@service/http/httpUtil'
import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import CrashUtility from '../../utility/CrashUtility'

const VoidResponse = io.unknown

export async function deleteTemplate(templateId: string): Promise<boolean> {
  try {
    const response = await httpDelete(`${Endpoints.Template}${templateId}`, VoidResponse)

    if (response?.status !== 204) {
      throw new Error(`Unexpected response status: ${response?.status}`)
    }

    return true
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
