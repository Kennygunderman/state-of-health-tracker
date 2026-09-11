import Endpoints, {
  assertNonProductionApi,
  assertNonProductionApiOrigin,
  isNonProductionApiOrigin
} from '@constants/endpoints'

const PRODUCTION_ORIGIN = 'https://stateofhealthapi.com'

// A URL parser reads this as host stateofhealthapi.com with path /@localhost:3000,
// so approving it as "localhost" would send development traffic to production.
const BACKSLASH_USERINFO_ORIGIN = 'http://stateofhealthapi.com\\@localhost:3000'

describe('isNonProductionApiOrigin', () => {
  describe('non-production origins', () => {
    it.each([
      'http://localhost:3000',
      'http://localhost',
      'https://localhost:8081',
      'HTTP://LOCALHOST:3000',
      'http://localhost.:3000',
      'http://127.0.0.1:3000',
      'http://10.0.0.5:3000',
      'http://172.16.0.1',
      'http://172.31.255.255:3000',
      'http://192.168.1.20:3000',
      'https://abc123.ngrok-free.app',
      'https://foo.ngrok.io',
      'https://x.ngrok.app',
      'https://y.ngrok.dev'
    ])('accepts %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(true)
    })
  })

  describe('production hosts and lookalikes', () => {
    it.each([
      'https://stateofhealthapi.com',
      'https://api.stateofhealthapi.com',
      'https://notstateofhealthapi.com',
      'https://stateofhealthapi.com.evil.com',
      'https://w3fv96liu9.execute-api.us-east-2.amazonaws.com/prod'
    ])('rejects %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })
  })

  describe('userinfo and scheme bypasses', () => {
    it('rejects the backslash form a URL parser resolves as host stateofhealthapi.com', () => {
      expect(isNonProductionApiOrigin(BACKSLASH_USERINFO_ORIGIN)).toBe(false)
    })

    it.each([
      'http://stateofhealthapi.com\\@127.0.0.1',
      'http://localhost@stateofhealthapi.com',
      'http://user@localhost:3000',
      'http://stateofhealthapi.com/@localhost:3000',
      'http://stateofhealthapi.com#@localhost',
      'http://stateofhealthapi.com?x=@localhost',
      'ftp://localhost:3000',
      // eslint-disable-next-line no-script-url -- a rejected-scheme fixture, never navigated to
      'javascript://localhost',
      'file://localhost',
      '//localhost:3000',
      'localhost:3000'
    ])('rejects %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })
  })

  describe('malformed IPv4 hosts and ports', () => {
    it.each([
      'http://10.999.999.999',
      'http://192.168.400.1',
      'http://192.168.010.1',
      'http://0x0a.0.0.1',
      'http://10.1',
      'http://3232235777',
      'http://010.0.0.1'
    ])('rejects %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })

    it.each(['http://172.15.0.1', 'http://172.32.0.1', 'http://11.0.0.1', 'http://192.169.1.1'])(
      'rejects %s, which sits outside the private ranges',
      origin => {
        expect(isNonProductionApiOrigin(origin)).toBe(false)
      }
    )

    it.each([
      'http://localhost:99999',
      'http://localhost:0',
      'http://localhost:',
      'http://localhost:3000:8080',
      'http://localhost:abc'
    ])('rejects %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })
  })

  describe('unparseable origins', () => {
    it.each([
      '',
      '   ',
      'http://local host:3000',
      'http://localhost%2Estateofhealthapi.com',
      'http://localhost\n.stateofhealthapi.com',
      'http://localhost。stateofhealthapi.com',
      'http://[::1]:3000',
      'http://localhost:3000/'
    ])('rejects %j', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })

    // baseApiUrl is built from the raw variable, so a padded value the guard
    // trimmed would be approved while every request URL built from it is
    // unparseable — and String.trim() strips U+00A0 and U+2028, which a URL
    // parser keeps.
    it.each(['http://localhost:3000 ', ' http://localhost:3000', '\u00a0http://localhost:3000'])(
      'rejects %j rather than trimming it to a host it approves',
      origin => {
        expect(isNonProductionApiOrigin(origin)).toBe(false)
      }
    )
  })

  describe('ngrok lookalikes', () => {
    it.each(['https://ngrok.attacker.com', 'https://myngrok.io', 'https://evil.ngrok.io.attacker.com'])(
      'rejects %s',
      origin => {
        expect(isNonProductionApiOrigin(origin)).toBe(false)
      }
    )
  })
})

describe('assertNonProductionApiOrigin', () => {
  it('throws that the variable is not set for undefined', () => {
    expect(() => assertNonProductionApiOrigin(undefined)).toThrow('SOH_API_BASE_URL is not set')
  })

  it('throws that the variable is not set for an empty origin', () => {
    expect(() => assertNonProductionApiOrigin('')).toThrow('SOH_API_BASE_URL is not set')
  })

  it('throws that the variable is not set for a whitespace-only origin', () => {
    expect(() => assertNonProductionApiOrigin('   ')).toThrow('SOH_API_BASE_URL is not set')
  })

  it('throws for a padded origin rather than trimming it into an approved host', () => {
    expect(() => assertNonProductionApiOrigin('http://localhost:3000 ')).toThrow(
      'SOH_API_BASE_URL is not a bare http(s) origin, got http://localhost:3000 '
    )
  })

  it('throws naming the production origin it was given', () => {
    expect(() => assertNonProductionApiOrigin(PRODUCTION_ORIGIN)).toThrow(
      `SOH_API_BASE_URL must point at a non-production API in development and tests, got ${PRODUCTION_ORIGIN}`
    )
  })

  it('throws for the backslash userinfo form instead of accepting it as localhost', () => {
    expect(() => assertNonProductionApiOrigin(BACKSLASH_USERINFO_ORIGIN)).toThrow(
      `SOH_API_BASE_URL is not a bare http(s) origin, got ${BACKSLASH_USERINFO_ORIGIN}`
    )
  })

  it('does not throw for a loopback development origin', () => {
    expect(() => assertNonProductionApiOrigin('http://localhost:3000')).not.toThrow()
  })
})

describe('assertNonProductionApi', () => {
  it('does not throw under the tracked test environment origin', () => {
    expect(() => assertNonProductionApi()).not.toThrow()
  })
})

describe('Endpoints', () => {
  it('resolves its base url from the environment rather than the production fallback', () => {
    expect(Endpoints.User).not.toContain('stateofhealthapi.com')
  })

  it('is built from an origin the preflight accepts', () => {
    const origin = Endpoints.User.replace('/api/user', '')

    expect(isNonProductionApiOrigin(origin)).toBe(true)
  })
})
