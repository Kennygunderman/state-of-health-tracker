// Not colocated beside its subject because the plan fixes this path. The exported predicate is driven directly
// because `module:react-native-dotenv` inlines SOH_API_BASE_URL and deletes the `@env` import at transform time,
// so no module remains for jest.mock('@env') to replace.
import Endpoints, {
  assertNonProductionApi,
  assertNonProductionApiOrigin,
  isNonProductionApiOrigin,
  isOriginPreflightEnforced,
  PRODUCTION_API_FALLBACK_ORIGIN,
  resolveApiOrigin,
  SOH_DEV_API_HOSTS
} from '@constants/endpoints'

const PRODUCTION_ORIGIN = 'https://stateofhealthapi.com'

// A URL parser reads this as host stateofhealthapi.com with path /@localhost:3000,
// so approving it as "localhost" would send development traffic to production.
const BACKSLASH_USERINFO_ORIGIN = 'http://stateofhealthapi.com\\@localhost:3000'

// Pinned here rather than imported, so a regression to interpolating the
// rejected value into the guard's messages fails these tests.
const MALFORMED_ORIGIN_MESSAGE =
  'SOH_API_BASE_URL is not a bare http(s) origin. Expected http(s)://host[:port] with no path, credentials or query. The configured value is not logged.'

const PRODUCTION_ORIGIN_MESSAGE =
  'SOH_API_BASE_URL must point at a non-production API in development and tests. Allowed: localhost, 127.0.0.1, a private LAN address, an *.ngrok* tunnel or a SOH_DEV_API_HOSTS entry. The configured value is not logged.'

const USERINFO_PASSWORD = 'p4ss-8f21c0-userinfo'
const QUERY_ACCESS_TOKEN = 'tok-4d19ab-query'
const FORGED_HEADER_TOKEN = 'bearer-77e3f5-header'
const TOKEN_SHAPED_HOST = 'sk-live-2b91d4-host'

interface CredentialBearingCase {
  label: string
  origin: string
  secret: string
  message: string
}

// The label, never the origin, builds the Jest title: the runner's output is a
// log sink too, so a `%s` title on these rows would reproduce the very leak
// these cases exist to rule out.
const CREDENTIAL_BEARING_CASES: CredentialBearingCase[] = [
  {
    label: 'userinfo carrying a password',
    origin: `http://admin:${USERINFO_PASSWORD}@localhost:3000`,
    secret: USERINFO_PASSWORD,
    message: MALFORMED_ORIGIN_MESSAGE
  },
  {
    label: 'a query string carrying an access token',
    origin: `http://localhost:3000/?access_token=${QUERY_ACCESS_TOKEN}`,
    secret: QUERY_ACCESS_TOKEN,
    message: MALFORMED_ORIGIN_MESSAGE
  },
  {
    label: 'a control character followed by a forged Authorization header',
    origin: `http://localhost:3000\nAuthorization: Bearer ${FORGED_HEADER_TOKEN}`,
    secret: FORGED_HEADER_TOKEN,
    message: MALFORMED_ORIGIN_MESSAGE
  },
  {
    // This one parses as a DNS name, so the production branch rejects it —
    // proving that message is redacted too, and that no "parsed host" is safe
    // to print when the host itself can be the pasted secret.
    label: 'a token pasted in place of the host',
    origin: `http://${TOKEN_SHAPED_HOST}`,
    secret: TOKEN_SHAPED_HOST,
    message: PRODUCTION_ORIGIN_MESSAGE
  }
]

const messageThrownFor = (origin: string): string => {
  try {
    assertNonProductionApiOrigin(origin)
  } catch (error) {
    return (error as Error).message
  }

  throw new Error('assertNonProductionApiOrigin accepted an origin it must reject')
}

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
      'https://w3fv96liu9.execute-api.us-east-2.amazonaws.com/prod',
      'https://w3fv96liu9.execute-api.us-east-2.amazonaws.com'
    ])('rejects %s', origin => {
      expect(isNonProductionApiOrigin(origin)).toBe(false)
    })
  })

  describe('hosts that merely contain a permitted name', () => {
    it.each([
      'https://localhost.evil.com',
      'https://notlocalhost',
      'https://localhost-staging.example.com',
      'https://127.0.0.1.evil.com'
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

  describe('an injected SOH_DEV_API_HOSTS allowlist', () => {
    // A public-looking DNS name on purpose: it is neither loopback, private LAN nor an ngrok tunnel, so
    // acceptance can only come from the injected list. The parser lower-cases the host and strips one
    // trailing dot, so the shouted and dotted forms have to match the same entry.
    const INJECTED_DEV_API_HOSTS = ['dev-api.internal.example']

    it.each([
      'https://dev-api.internal.example',
      'https://dev-api.internal.example:8443',
      'HTTPS://DEV-API.INTERNAL.EXAMPLE',
      'https://dev-api.internal.example.:8443'
    ])('accepts %s because the injected list carries its host', origin => {
      expect(isNonProductionApiOrigin(origin, INJECTED_DEV_API_HOSTS)).toBe(true)
    })

    it.each([
      'https://notdev-api.internal.example',
      'https://dev-api.internal.example.evil.com',
      'https://evil.dev-api.internal.example',
      PRODUCTION_ORIGIN
    ])('rejects %s, which the injected list does not carry', origin => {
      expect(isNonProductionApiOrigin(origin, INJECTED_DEV_API_HOSTS)).toBe(false)
    })

    it('rejects an allow-listed host against the shipped list, which is empty, so the default is closed', () => {
      expect(isNonProductionApiOrigin('https://dev-api.internal.example')).toBe(false)
    })

    // Vacuous while the shipped list is empty — the injected cases above are what prove the branch today. It
    // is written as a loop because it.each over an empty array throws, and it exists so a host added to the
    // shipped list is covered without a new test.
    it('accepts every host the shipped list carries', () => {
      for (const host of SOH_DEV_API_HOSTS) {
        expect(isNonProductionApiOrigin(`https://${host}`)).toBe(true)
      }
    })
  })
})

describe('release builds, where the preflight never runs', () => {
  it('returns false for a rejected origin instead of throwing, so classification stays side-effect free', () => {
    expect(() => isNonProductionApiOrigin(PRODUCTION_ORIGIN)).not.toThrow()
    expect(() => isNonProductionApiOrigin('')).not.toThrow()
    expect(() => isNonProductionApiOrigin(BACKSLASH_USERINFO_ORIGIN)).not.toThrow()
  })

  it('resolves an absent SOH_API_BASE_URL to the production fallback', () => {
    expect(resolveApiOrigin(undefined)).toBe(PRODUCTION_API_FALLBACK_ORIGIN)
    expect(resolveApiOrigin(undefined)).toBe('https://stateofhealthapi.com')
  })

  it('resolves an empty SOH_API_BASE_URL to the production fallback', () => {
    expect(resolveApiOrigin('')).toBe(PRODUCTION_API_FALLBACK_ORIGIN)
    expect(resolveApiOrigin('')).toBe('https://stateofhealthapi.com')
  })

  it('resolves a configured origin to itself', () => {
    expect(resolveApiOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    expect(resolveApiOrigin('https://dev-api.internal.example')).toBe('https://dev-api.internal.example')
  })

  it('is the resolver the shipped endpoints are built from', () => {
    expect(Endpoints.MacroTargets).toBe(`${resolveApiOrigin('http://localhost:3000')}/api/user/targets`)
  })

  it('enforces the preflight under a development build or Jest, and skips it only when neither applies', () => {
    expect(isOriginPreflightEnforced({isDevBuild: false, isJestRuntime: false})).toBe(false)
    expect(isOriginPreflightEnforced({isDevBuild: true, isJestRuntime: false})).toBe(true)
    expect(isOriginPreflightEnforced({isDevBuild: false, isJestRuntime: true})).toBe(true)
    expect(isOriginPreflightEnforced({isDevBuild: true, isJestRuntime: true})).toBe(true)
  })

  it('falls back to the one origin development and tests refuse', () => {
    const message = messageThrownFor(PRODUCTION_API_FALLBACK_ORIGIN)

    expect(isNonProductionApiOrigin(PRODUCTION_API_FALLBACK_ORIGIN)).toBe(false)
    expect(message).toBe(PRODUCTION_ORIGIN_MESSAGE)
    expect(message).not.toContain(PRODUCTION_API_FALLBACK_ORIGIN)
  })

  it('throws that the variable is not set when the release path has nothing to fall back from', () => {
    expect(() => assertNonProductionApiOrigin(undefined)).toThrow('SOH_API_BASE_URL is not set')
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
    expect(messageThrownFor('http://localhost:3000 ')).toBe(MALFORMED_ORIGIN_MESSAGE)
  })

  it('throws for a production origin without repeating the value it was given', () => {
    const message = messageThrownFor(PRODUCTION_ORIGIN)

    expect(message).toBe(PRODUCTION_ORIGIN_MESSAGE)
    expect(message).not.toContain(PRODUCTION_ORIGIN)
  })

  it('throws for the backslash userinfo form instead of accepting it as localhost', () => {
    const message = messageThrownFor(BACKSLASH_USERINFO_ORIGIN)

    expect(message).toBe(MALFORMED_ORIGIN_MESSAGE)
    expect(message).not.toContain(BACKSLASH_USERINFO_ORIGIN)
  })

  it('does not throw for a loopback development origin', () => {
    expect(() => assertNonProductionApiOrigin('http://localhost:3000')).not.toThrow()
  })

  describe('values carrying a credential', () => {
    it.each(CREDENTIAL_BEARING_CASES)('rejects $label without echoing it', ({origin, secret, message}) => {
      const thrown = messageThrownFor(origin)

      expect(thrown).not.toContain(secret)
      expect(thrown).not.toContain(origin)
      expect(thrown).toBe(message)
    })
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

  it('appends /api to the resolved origin for the untouched user targets route', () => {
    expect(Endpoints.MacroTargets).toBe('http://localhost:3000/api/user/targets')
  })
})
