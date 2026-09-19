import {getBearerToken} from '@service/auth/getBearerToken'
import CrashUtility from '@utility/CrashUtility'
import axios, {CreateAxiosDefaults} from 'axios'
import * as io from 'io-ts'

import {CONFIGURED_API_ORIGIN, PRODUCTION_API_FALLBACK_ORIGIN} from '@constants/endpoints'

import httpRequest from '../httpRequest'

// Explicit factories rather than automock: the real modules reach the native
// Firebase auth and crashlytics chain, which cannot load under Jest.
jest.mock('@service/auth/getBearerToken', () => ({
  getBearerToken: jest.fn()
}))

jest.mock('@utility/CrashUtility', () => ({
  recordError: jest.fn()
}))

// The instance is callable as well as an object: the 401 refresh path replays a request by invoking it
// directly (`axiosInstance(originalRequest)`), so a plain object here would fail that path for the wrong
// reason.
jest.mock('axios', () => ({
  create: jest.fn(() =>
    Object.assign(jest.fn(), {
      interceptors: {response: {use: jest.fn()}},
      request: jest.fn()
    })
  )
}))

const mockedCreate = jest.mocked(axios.create)

type RejectionHandler = (error: unknown) => Promise<unknown>

// Captured once, because the instance and its configuration are built when
// httpRequest is imported and jest.clearAllMocks() drops the recorded calls.
const createdConfig: CreateAxiosDefaults = mockedCreate.mock.calls[0][0] ?? {}
const mockInstance = mockedCreate.mock.results[0].value as unknown as jest.Mock
const mockRequest = mockedCreate.mock.results[0].value.request as unknown as jest.Mock

// The rejection half of the instance's one response interceptor, captured the same way and for the same
// reason: it is registered at import time, and the failure path carries its own origin check.
const onRejected = (mockedCreate.mock.results[0].value.interceptors.response.use as unknown as jest.Mock).mock
  .calls[0][1] as RejectionHandler

const mockGetBearerToken = jest.mocked(getBearerToken)
const mockRecordError = jest.mocked(CrashUtility.recordError)

const TestResponse = io.type({ok: io.boolean})

const REQUEST_URL = `${CONFIGURED_API_ORIGIN}/api/catalog/foods?q=rice&page=1&limit=25`
const REQUEST_PATH = '/api/catalog/foods'
const FOREIGN_URL = `${PRODUCTION_API_FALLBACK_ORIGIN}/api/catalog/foods?q=rice&page=1&limit=25`
const FOREIGN_HOST = 'stateofhealthapi.com'

// The configured origin comes from the tracked .env.test, which points this suite at a loopback development
// API. The three final URLs below rebuild that origin as the shapes a redirect produces without leaving the
// site — a scheme upgrade, the other spelling of loopback, a proxy on another port — rather than hardcoding a
// value the environment supplies.
const LOOPBACK_ALIASES: Record<string, string> = {localhost: '127.0.0.1', '127.0.0.1': 'localhost'}
const PROXY_PORT = 8443

const configuredAuthority = /^https?:\/\/([a-z0-9.-]+)(?::(\d+))?$/i.exec(CONFIGURED_API_ORIGIN)

if (!configuredAuthority || !LOOPBACK_ALIASES[configuredAuthority[1]]) {
  throw new Error('this suite drives the loopback-alias case, so SOH_API_BASE_URL must be a bare loopback origin')
}

const [, CONFIGURED_HOST, CONFIGURED_PORT] = configuredAuthority
const CONFIGURED_PORT_SUFFIX = CONFIGURED_PORT ? `:${CONFIGURED_PORT}` : ''

const SAME_SITE_FINAL_URLS: [string, string][] = [
  ['a scheme upgrade', `https://${CONFIGURED_HOST}${CONFIGURED_PORT_SUFFIX}${REQUEST_PATH}`],
  [
    'the other spelling of loopback',
    `http://${LOOPBACK_ALIASES[CONFIGURED_HOST]}${CONFIGURED_PORT_SUFFIX}${REQUEST_PATH}`
  ],
  ['a proxy on another port', `http://${CONFIGURED_HOST}:${PROXY_PORT}${REQUEST_PATH}`]
]

const recordedMessage = (): string => (mockRecordError.mock.calls[0][0] as Error).message

beforeEach(() => {
  jest.clearAllMocks()
  mockGetBearerToken.mockResolvedValue('token-under-test')
})

describe('the shared axios instance', () => {
  // The transport must not turn a legitimate redirect into a failure: pinning maxRedirects to 0 makes axios
  // swap follow-redirects for the raw transport under the adapters that decide in JS, so a 3xx from a
  // deployment that redirects comes back as a status no validateStatus accepts instead of being followed.
  // Where a response may have come from is bounded by the same-site check on the final URL, not by this.
  it('does not pin maxRedirects, and carries the established timeout', () => {
    expect(createdConfig.maxRedirects).toBeUndefined()
    expect(createdConfig.timeout).toBe(25_000)
  })
})

describe('httpRequest', () => {
  describe('a response the transport reports from the configured origin', () => {
    it('decodes and returns it', async () => {
      mockRequest.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL: REQUEST_URL}})

      await expect(httpRequest('GET', REQUEST_URL, TestResponse)).resolves.toEqual({data: {ok: true}, status: 200})
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it('accepts a same-origin final URL on another path, which a same-origin redirect produces', async () => {
      mockRequest.mockResolvedValue({
        data: {ok: true},
        status: 200,
        request: {responseURL: `${CONFIGURED_API_ORIGIN}/api/catalog/foods/v2?q=rice`}
      })

      await expect(httpRequest('GET', REQUEST_URL, TestResponse)).resolves.toEqual({data: {ok: true}, status: 200})
      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  // The response rule is same-site rather than same-origin, because these three shapes are what a deployment
  // that redirects reports as its final URL. Refusing them would fail every request it serves while the bytes
  // never left the site.
  describe('a response the transport reports from the same site on another origin', () => {
    it.each(SAME_SITE_FINAL_URLS)('decodes and returns it after %s', async (_shape, responseURL) => {
      mockRequest.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL}})

      await expect(httpRequest('GET', REQUEST_URL, TestResponse)).resolves.toEqual({data: {ok: true}, status: 200})
      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe('a response the transport reports from another origin', () => {
    it('rejects it instead of decoding, and records the escape', async () => {
      mockRequest.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL: FOREIGN_URL}})

      await expect(httpRequest('GET', REQUEST_URL, TestResponse)).rejects.toThrow(
        `unexpected final host ${FOREIGN_HOST}`
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it('names the method and the request path without the query string or the configured origin', async () => {
      mockRequest.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL: FOREIGN_URL}})

      await expect(httpRequest('POST', REQUEST_URL, TestResponse, {useAuth: true}, {})).rejects.toThrow()

      const message = recordedMessage()

      expect(message).toContain('POST')
      expect(message).toContain(REQUEST_PATH)
      expect(message).not.toContain('q=rice')
      expect(message).not.toContain(CONFIGURED_API_ORIGIN)
    })

    it('drops userinfo from the final host it reports', async () => {
      mockRequest.mockResolvedValue({
        data: {ok: true},
        status: 200,
        request: {responseURL: `http://user:secret-8f21c0@${FOREIGN_HOST}/api/user`}
      })

      await expect(httpRequest('GET', REQUEST_URL, TestResponse)).rejects.toThrow()

      const message = recordedMessage()

      expect(message).toContain(`unexpected final host ${FOREIGN_HOST}`)
      expect(message).not.toContain('secret-8f21c0')
    })
  })

  describe('a response reporting no final URL', () => {
    it.each([{}, undefined, {responseURL: ''}, {responseURL: 7}])(
      'is accepted for request %j, because an adapter that omits it must not fail every request',
      request => {
        mockRequest.mockResolvedValue({data: {ok: true}, status: 200, request})

        return expect(httpRequest('GET', REQUEST_URL, TestResponse)).resolves.toEqual({
          data: {ok: true},
          status: 200
        })
      }
    )
  })

  // The failure path is checked as well as the success path, and ahead of the token refresh: a redirect that
  // landed on another origin can answer 401 or 5xx as readily as 200, and a 401 taken at face value there
  // would mint a fresh token and replay the request, sending a second credential after the first.
  describe('a failed response the transport reports from another origin', () => {
    const rejectionFor = async (status: number, responseURL: string): Promise<Error> => {
      const error = {
        config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer token-under-test'}},
        response: {status, data: {error: 'unauthorized'}, request: {responseURL}},
        request: {responseURL}
      }

      try {
        await onRejected(error)
      } catch (rejected) {
        return rejected as Error
      }

      throw new Error('the interceptor accepted a response from another origin')
    }

    it.each([401, 403, 500, 502])('reports a %i as an origin escape rather than as its own status', async status => {
      const rejected = await rejectionFor(status, FOREIGN_URL)

      expect(rejected.message).toBe(
        `Refusing a GET response for ${REQUEST_PATH}: unexpected final host ${FOREIGN_HOST}`
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it('does not refresh the token or replay the request for an escaped 401', async () => {
      await rejectionFor(401, FOREIGN_URL)

      expect(mockGetBearerToken).not.toHaveBeenCalled()
      expect(mockInstance).not.toHaveBeenCalled()
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it('leaves a same-origin 401 to the refresh path it already had', async () => {
      mockGetBearerToken.mockResolvedValue('refreshed-token')
      mockInstance.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL: REQUEST_URL}})

      await onRejected({
        config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer stale-token'}},
        response: {status: 401, request: {responseURL: REQUEST_URL}},
        request: {responseURL: REQUEST_URL}
      })

      expect(mockGetBearerToken).toHaveBeenCalledWith(true)
      expect(mockInstance).toHaveBeenCalledTimes(1)
      expect(mockInstance.mock.calls[0][0].headers.Authorization).toBe('Bearer refreshed-token')
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it.each(SAME_SITE_FINAL_URLS)(
      'leaves a 401 reported from the same site after %s to the refresh path, replayed exactly once',
      async (_shape, responseURL) => {
        mockGetBearerToken.mockResolvedValue('refreshed-token')
        mockInstance.mockResolvedValue({data: {ok: true}, status: 200, request: {responseURL}})

        await onRejected({
          config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer stale-token'}},
          response: {status: 401, request: {responseURL}},
          request: {responseURL}
        })

        expect(mockGetBearerToken).toHaveBeenCalledTimes(1)
        expect(mockGetBearerToken).toHaveBeenCalledWith(true)
        expect(mockInstance).toHaveBeenCalledTimes(1)
        expect(mockInstance.mock.calls[0][0].headers.Authorization).toBe('Bearer refreshed-token')
        expect(mockInstance.mock.calls[0][0]._retry).toBe(true)
        expect(mockRecordError).not.toHaveBeenCalled()
      }
    )

    it('passes a failure carrying no final URL through unchanged, so error classification still sees it', async () => {
      const error = {config: {method: 'get', url: REQUEST_URL}, request: {}, message: 'Network Error'}

      await expect(onRejected(error)).rejects.toBe(error)
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    // The four invariants the same-site check must leave exactly as they were: it only decides whether a
    // reported final URL is refused, and every other condition the refresh depends on is the 401 block's own.
    it('refreshes and replays a 401 that reports no final URL, because the check fails open on silence', async () => {
      mockGetBearerToken.mockResolvedValue('refreshed-token')
      mockInstance.mockResolvedValue({data: {ok: true}, status: 200, request: {}})

      await onRejected({
        config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer stale-token'}},
        response: {status: 401, request: {}},
        request: {}
      })

      expect(mockGetBearerToken).toHaveBeenCalledWith(true)
      expect(mockInstance).toHaveBeenCalledTimes(1)
      expect(mockRecordError).not.toHaveBeenCalled()
    })

    it('does not refresh a same-site 401 that carried no Authorization header', async () => {
      const error = {
        config: {method: 'get', url: REQUEST_URL},
        response: {status: 401, request: {responseURL: REQUEST_URL}},
        request: {responseURL: REQUEST_URL}
      }

      await expect(onRejected(error)).rejects.toBe(error)
      expect(mockGetBearerToken).not.toHaveBeenCalled()
      expect(mockInstance).not.toHaveBeenCalled()
    })

    it('does not refresh a same-site 500', async () => {
      const error = {
        config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer token-under-test'}},
        response: {status: 500, request: {responseURL: REQUEST_URL}},
        request: {responseURL: REQUEST_URL}
      }

      await expect(onRejected(error)).rejects.toBe(error)
      expect(mockGetBearerToken).not.toHaveBeenCalled()
      expect(mockInstance).not.toHaveBeenCalled()
    })

    it('replays a 401 once and never again, so a second 401 cannot loop', async () => {
      const error = {
        config: {method: 'get', url: REQUEST_URL, headers: {Authorization: 'Bearer stale-token'}, _retry: true},
        response: {status: 401, request: {responseURL: REQUEST_URL}},
        request: {responseURL: REQUEST_URL}
      }

      await expect(onRejected(error)).rejects.toBe(error)
      expect(mockGetBearerToken).not.toHaveBeenCalled()
      expect(mockInstance).not.toHaveBeenCalled()
    })
  })

  describe('a request URL outside the configured origin', () => {
    it('throws before a bearer token is attached and before the request is made', async () => {
      await expect(httpRequest('POST', FOREIGN_URL, TestResponse, {useAuth: true}, {})).rejects.toThrow(
        `Refusing POST to a URL outside the configured API origin: ${REQUEST_PATH}`
      )

      expect(mockGetBearerToken).not.toHaveBeenCalled()
      expect(mockRequest).not.toHaveBeenCalled()
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(recordedMessage()).not.toContain('q=rice')
    })

    it.each(['', 'localhost:3000/api/user', `http://user@${FOREIGN_HOST}/api/user`])(
      'throws for %j without reaching the transport',
      async url => {
        await expect(httpRequest('GET', url, TestResponse)).rejects.toThrow('outside the configured API origin')

        expect(mockGetBearerToken).not.toHaveBeenCalled()
        expect(mockRequest).not.toHaveBeenCalled()
      }
    )
  })
})
