import {getBearerToken} from '@service/auth/getBearerToken'
import CrashUtility from '@utility/CrashUtility'
import axios, {AxiosRequestConfig, Method} from 'axios'
import {isLeft} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

export interface HttpResponse<T> {
  data: T
  status: number
}

export interface HttpRequestOptions {
  useAuth?: boolean
}

/**
 * The deadline for every API request the app makes, and the number every
 * server-side budget is sized against.
 *
 * It is the single client timeout policy: one axios instance serves every
 * request function in `src/queries/api/`, so a request that has not answered
 * within this window is abandoned here and the caller sees a transport error
 * with no status and no body — indistinguishable from a request that never
 * arrived, which is why an endpoint that could exceed it cannot report a
 * failure the app can act on.
 *
 * The backend therefore keeps its vendor work inside this window rather than
 * the app waiting longer: `backend/src/services/openrouter.service.ts` bounds a
 * whole AI request at `OPENROUTER_REQUEST_TIMEOUT_MS` (18 s) and
 * `backend/src/services/usda.service.ts` bounds one request-path USDA call at
 * `USDA_REQUEST_CALL_BUDGET_MS` (6 s), leaving room for upload, authentication
 * and serialisation, so `/api/macros/estimate` and `/api/macros/label-scan`
 * return their `502 estimation_failed` before this timeout fires. Raising a
 * backend deadline past this value re-creates the failure it was chosen to
 * prevent: the app gives up, the paid call continues, and the retry is charged
 * again.
 *
 * Exported so a caller needing a request deadline reads it here instead of
 * writing its own; there is deliberately no per-request override.
 */
export const HTTP_REQUEST_TIMEOUT_MS = 25_000

const axiosInstance = axios.create({
  timeout: HTTP_REQUEST_TIMEOUT_MS
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
  // Opaque here: the body is whatever the calling request function serialises,
  // and this function only forwards it. `unknown` rather than `any` so nothing
  // downstream can read a field off it without narrowing first.
  body?: unknown
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
