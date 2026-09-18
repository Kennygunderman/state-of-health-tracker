import {getBearerToken} from '@service/auth/getBearerToken'
import CrashUtility from '@utility/CrashUtility'
import axios, {AxiosRequestConfig, Method} from 'axios'
import {isLeft} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

import {isConfiguredApiOriginUrl} from '@constants/endpoints'

export interface HttpResponse<T> {
  data: T
  status: number
}

export interface HttpRequestOptions {
  useAuth?: boolean
}

const axiosInstance = axios.create({
  timeout: 25_000,
  // Binds only the adapters that decide in JS — the Node http adapter a Jest or
  // CI runner uses, where this turns a 3xx into a failure instead of a hop.
  // React Native's XHR adapter follows redirects inside the native HTTP stack
  // and never consults this, which is why the response below is also checked
  // against the final URL the transport reports.
  maxRedirects: 0
})

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as AxiosRequestConfig & {_retry?: boolean}

    // The final-URL check belongs on the failure path too, and ahead of the
    // refresh below: a redirect that landed on another origin can answer 401 or
    // 5xx as readily as 200, and treating that 401 as our own would mint a fresh
    // token and replay the request — sending a new credential after the first.
    // An escaped response is a failure in its own right, never an
    // authentication failure to recover from, so it is reported as one.
    const escapedFinalUrl = reportedFinalUrl(error.response?.request ?? error.request)

    if (escapedFinalUrl !== null && !isConfiguredApiOriginUrl(escapedFinalUrl)) {
      const escape = originEscapeError(originalRequest?.method, originalRequest?.url, escapedFinalUrl)

      CrashUtility.recordError(escape)

      return Promise.reject(escape)
    }

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

const HTTP_SCHEME_PREFIX = /^https?:\/\//i
const AUTHORITY_TERMINATOR = /[/?#]/
const QUERY_OR_FRAGMENT = /[?#]/
const UNKNOWN_METHOD = 'request'

const authorityOf = (url: string): string => {
  const afterScheme = url.replace(HTTP_SCHEME_PREFIX, '')
  const terminator = afterScheme.search(AUTHORITY_TERMINATOR)

  return terminator === -1 ? afterScheme : afterScheme.slice(0, terminator)
}

const hostWithoutUserinfo = (url: string): string => {
  const authority = authorityOf(url)

  return authority.slice(authority.lastIndexOf('@') + 1)
}

const pathWithoutQuery = (url: string): string => {
  const afterScheme = url.replace(HTTP_SCHEME_PREFIX, '')

  return afterScheme.slice(authorityOf(url).length).split(QUERY_OR_FRAGMENT)[0]
}

// The URL a transport says it ended up at. React Native's XMLHttpRequest carries
// it on the request object, which axios hands back on a response and on an error
// alike, so one reader serves both paths below.
const reportedFinalUrl = (carrier: unknown): string | null => {
  const responseURL = (carrier as {responseURL?: unknown} | undefined)?.responseURL

  return typeof responseURL === 'string' && responseURL !== '' ? responseURL : null
}

const originEscapeError = (method: string | undefined, url: string | undefined, finalUrl: string): Error =>
  new Error(
    `Refusing a ${(method ?? UNKNOWN_METHOD).toUpperCase()} response for ${pathWithoutQuery(url ?? '')}: ` +
      `unexpected final host ${hostWithoutUserinfo(finalUrl)}`
  )

async function httpRequest<T>(
  method: Method,
  url: string,
  decoder: io.Type<T>,
  options: HttpRequestOptions = {useAuth: true},
  // `unknown` rather than `any`: nothing here reads the body, it is handed to
  // axios as-is, and the callers in `httpUtil.ts` still pass whatever they hold.
  body?: unknown
): Promise<HttpResponse<T>> {
  if (!isConfiguredApiOriginUrl(url)) {
    const error = new Error(`Refusing ${method} to a URL outside the configured API origin: ${pathWithoutQuery(url)}`)

    CrashUtility.recordError(error)
    throw error
  }

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

  const finalUrl = reportedFinalUrl(response.request)

  // React Native's XMLHttpRequest reports responseURL on both platforms, but
  // only once the native stack has already followed any redirect: this contains
  // the response rather than preventing the hop, and maxRedirects above plus the
  // request check before the token is attached are the preventive halves. What
  // no JavaScript here can do is refuse the hop itself — that needs a transport
  // whose redirect callback the app controls, which on this stack means native
  // configuration (see docs/meal-planning.md). The residual on this side is an
  // adapter that reports no final URL at all: those bytes are accepted, because
  // failing closed on silence would break every request made through one.
  if (finalUrl !== null && !isConfiguredApiOriginUrl(finalUrl)) {
    const error = originEscapeError(method, url, finalUrl)

    CrashUtility.recordError(error)
    throw error
  }

  const decoded = decoder.decode(response.data)

  if (isLeft(decoded)) {
    // The one place a decode failure is turned into an error, and deliberately not by serialising the io-ts
    // failures: every link of their context chain carries an `actual` — the root one being the whole response
    // body — so `JSON.stringify` on them puts the payload into the message and from there into crash
    // telemetry. CrashUtility reports the method, the endpoint path and the codec paths that failed, records
    // it once, and marks it, so the catch blocks in the request functions above re-record nothing.
    throw CrashUtility.recordDecodeFailure(method, url, decoded.left)
  }

  return {
    data: decoded.right,
    status: response.status
  }
}

export default httpRequest
