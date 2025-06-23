import axios, {AxiosRequestConfig, Method} from 'axios'

import {getBearerToken} from '@service/auth/getBearerToken'

import {isLeft} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

import CrashUtility from '../../utility/CrashUtility'

export interface HttpResponse<T> {
  data: T
  status: number
}

export interface HttpRequestOptions {
  useAuth?: boolean
}

async function httpRequest<T>(
  method: Method,
  url: string,
  decoder: io.Type<T>,
  options: HttpRequestOptions = {useAuth: true},
  body?: any
): Promise<HttpResponse<T>> {
  const conf: AxiosRequestConfig = {}

  if (options.useAuth) {
    const token = await getBearerToken()

    if (!token) {
      const error = new Error('Bearer token is required for HTTP request: ' + url)

      CrashUtility.recordError(error)
      throw error
    }

    conf.headers = {
      Authorization: `Bearer ${token}`
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
