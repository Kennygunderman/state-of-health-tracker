import axios, {AxiosRequestConfig, Method} from 'axios'
import {isLeft} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

import CrashUtility from '../../utility/CrashUtility'
import {getUserId} from '../auth/userStorage'

export interface HttpResponse<T> {
  data: T
  status: number
}

export interface HttpRequestOptions {
  useUserId?: boolean
}

async function httpRequest<T>(
  method: Method,
  url: string,
  decoder: io.Type<T>,
  options: HttpRequestOptions = {useUserId: true},
  body?: any
): Promise<HttpResponse<T>> {
  const conf: AxiosRequestConfig = {}
  if (options.useUserId) {
    const userId = await getUserId()
    if (!userId) {
      const error = new Error('userId is required for HTTP request: ' + url)
      CrashUtility.recordError(error)
      throw error
    }

    conf.headers = {
      'x-user-id': userId
    }
  }

  const axiosConfig: AxiosRequestConfig = {
    method,
    url,
    ...conf
  }

  if (method !== 'GET') {
    axiosConfig.data = body ?? {}
  }

  const response = await axios.request(axiosConfig)

  const decoded = decoder.decode(response.data)

  if (isLeft(decoded)) {
    const error = Error(`Decoding failed for ${method} ${url}: ${JSON.stringify(decoded.left)}`)
    CrashUtility.recordError(error)
    throw error
  }

  return {
    data: decoded.right,
    status: response.status
  }
}

export default httpRequest
