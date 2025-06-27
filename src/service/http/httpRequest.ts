import * as io from 'io-ts'
import axios, {AxiosRequestConfig, Method} from 'axios'
import {isLeft} from 'fp-ts/lib/Either'

import {getBearerToken} from '@service/auth/getBearerToken'

import CrashUtility from '../../utility/CrashUtility'

export interface HttpResponse<T> {
  data: T
  status: number
}

export interface HttpRequestOptions {
  useAuth?: boolean
}

const axiosInstance = axios.create({
  timeout: 25_000
})

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as AxiosRequestConfig & {_retry?: boolean}

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.headers?.Authorization) {
      originalRequest._retry = true

      const token = await getBearerToken(true)
      if (token) {
        if (!originalRequest.headers) originalRequest.headers = {}
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${token}`
        }

        return axiosInstance(originalRequest)
      }
    }

    return Promise.reject(error)
  }
)

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

  const response = await axiosInstance.request(axiosConfig)

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
