// Not colocated beside its subject because the plan fixes this path. The exported predicate is driven directly
// because `module:react-native-dotenv` inlines SOH_API_BASE_URL and deletes the `@env` import at transform time,
// so no module remains for jest.mock('@env') to replace.
import Endpoints, {
  assertNonProductionApi,
  assertNonProductionApiOrigin,
  CONFIGURED_API_ORIGIN,
  isConfiguredApiOriginUrl,
  isConfiguredApiSiteUrl,
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

describe('isConfiguredApiOriginUrl', () => {
  const CONFIGURED_ORIGIN = 'http://localhost:3000'

  describe('the origin this bundle was configured with', () => {
    it('accepts a request URL on that origin, path and query included', () => {
      expect(isConfiguredApiOriginUrl(`${CONFIGURED_API_ORIGIN}/api/catalog/foods?q=rice&page=1&limit=25`)).toBe(true)
      expect(isConfiguredApiOriginUrl(Endpoints.User)).toBe(true)
      expect(isConfiguredApiOriginUrl(Endpoints.CatalogFoodSearch('chicken breast', 1, 25))).toBe(true)
    })

    it('rejects a production-fallback URL while a non-production origin is configured', () => {
      expect(CONFIGURED_API_ORIGIN).not.toBe(PRODUCTION_API_FALLBACK_ORIGIN)
      expect(isConfiguredApiOriginUrl(`${PRODUCTION_API_FALLBACK_ORIGIN}/api/user`)).toBe(false)
      expect(isConfiguredApiOriginUrl(`${PRODUCTION_API_FALLBACK_ORIGIN}/api/meal-planning/plans/current`)).toBe(false)
    })
  })

  describe('an injected configured origin', () => {
    it.each([
      `${CONFIGURED_ORIGIN}/api/user`,
      `${CONFIGURED_ORIGIN}/api/catalog/foods?q=chicken%20breast&page=1&limit=25`,
      `${CONFIGURED_ORIGIN}/api/user#section`,
      CONFIGURED_ORIGIN,
      'HTTP://LOCALHOST:3000/api/user',
      'http://localhost.:3000/api/user'
    ])('accepts %s', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(true)
    })

    it.each([
      'http://localhost:3001/api/user',
      'https://localhost:3000/api/user',
      'http://localhost/api/user',
      'http://127.0.0.1:3000/api/user',
      `${PRODUCTION_ORIGIN}/api/user`
    ])('rejects %s', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })
  })

  describe('the scheme default port', () => {
    it.each([
      ['https://api.internal.example/api/user', 'https://api.internal.example:443'],
      ['https://api.internal.example:443/api/user', 'https://api.internal.example'],
      ['http://api.internal.example/api/user', 'http://api.internal.example:80'],
      ['http://api.internal.example:80/api/user', 'http://api.internal.example']
    ])('reads %s as the same origin as %s', (url, configuredOrigin) => {
      expect(isConfiguredApiOriginUrl(url, configuredOrigin)).toBe(true)
    })

    it.each([
      ['http://api.internal.example:443/api/user', 'https://api.internal.example:443'],
      ['https://api.internal.example:443/api/user', 'http://api.internal.example:443'],
      ['http://api.internal.example:443/api/user', 'https://api.internal.example'],
      ['https://api.internal.example/api/user', 'http://api.internal.example:443']
    ])('keeps %s apart from %s, where the port matches but the scheme does not', (url, configuredOrigin) => {
      expect(isConfiguredApiOriginUrl(url, configuredOrigin)).toBe(false)
    })
  })

  describe('authority forms that move the host a URL parser resolves', () => {
    it.each([
      'http://user@localhost:3000/api/user',
      `${BACKSLASH_USERINFO_ORIGIN}/api/user`,
      'http://localhost:3000\\@stateofhealthapi.com/api/user',
      'http://localhost:3000@stateofhealthapi.com/api/user',
      'http://stateofhealthapi.com#@localhost:3000/api/user',
      'http://stateofhealthapi.com?x=@localhost:3000/api/user'
    ])('rejects %j', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })
  })

  describe('hosts that merely contain the configured name', () => {
    it.each([
      'http://localhost.evil.com:3000/api/user',
      'http://notlocalhost:3000/api/user',
      'http://127.0.0.1.evil.com:3000/api/user',
      'http://localhost-staging.example.com:3000/api/user'
    ])('rejects %s', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })
  })

  describe('input no request built from Endpoints can carry', () => {
    it.each([
      '',
      '   ',
      'localhost:3000/api/user',
      '//localhost:3000/api/user',
      'ftp://localhost:3000/api/user',
      'http://local host:3000/api/user',
      'http://localhost:99999/api/user',
      'http://[::1]:3000/api/user',
      'http://localhost。stateofhealthapi.com:3000/api/user'
    ])('rejects %j', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })

    // Every builder in endpoints.ts percent-encodes the text it interpolates, so
    // a raw space or control character can only come from somewhere else — and
    // refusing it is what keeps a header-injection payload out of the stack.
    it.each([
      'http://localhost:3000/api/catalog/foods?q=a b',
      'http://localhost:3000/api/user\nHost: stateofhealthapi.com',
      'http://localhost:3000/api/user\u00a0'
    ])('rejects %j', url => {
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })
  })

  describe('a configured origin the parser cannot read', () => {
    it.each(['', '   ', 'localhost:3000', 'ftp://localhost:3000', 'http://local host', 'http://localhost:99999'])(
      'is inert for %j instead of rejecting every request the build makes',
      configuredOrigin => {
        expect(isConfiguredApiOriginUrl(`${PRODUCTION_ORIGIN}/api/user`, configuredOrigin)).toBe(true)
        expect(isConfiguredApiOriginUrl('http://localhost:3000/api/user', configuredOrigin)).toBe(true)
      }
    )
  })
})

// The response-side rule, which is deliberately weaker than the origin rule above: a deployment that redirects
// http to https, a bare domain to `www`, or through a proxy on another port never left the site, and the strict
// origin comparison would discard every response it serves. The domain shapes are driven through an explicit
// configured origin, because the one this bundle carries is a loopback host.
describe('isConfiguredApiSiteUrl', () => {
  const CONFIGURED_ORIGIN = 'http://localhost:3000'
  const CONFIGURED_DOMAIN = 'https://example.com'

  describe('the origin this bundle was configured with', () => {
    it('accepts a final URL on that origin, path and query included', () => {
      expect(isConfiguredApiSiteUrl(`${CONFIGURED_API_ORIGIN}/api/catalog/foods?q=rice&page=1&limit=25`)).toBe(true)
      expect(isConfiguredApiSiteUrl(Endpoints.User)).toBe(true)
      expect(isConfiguredApiSiteUrl(Endpoints.CatalogFoodSearch('chicken breast', 1, 25))).toBe(true)
    })

    it('rejects a production-fallback URL while a non-production origin is configured', () => {
      expect(CONFIGURED_API_ORIGIN).not.toBe(PRODUCTION_API_FALLBACK_ORIGIN)
      expect(isConfiguredApiSiteUrl(`${PRODUCTION_API_FALLBACK_ORIGIN}/api/user`)).toBe(false)
    })
  })

  describe('a final URL differing from the configured origin only in scheme, port or loopback spelling', () => {
    it.each([
      `${CONFIGURED_ORIGIN}/api/user`,
      CONFIGURED_ORIGIN,
      'https://localhost:3000/api/user',
      'https://localhost/api/user',
      'http://localhost/api/user',
      'http://localhost:8443/api/user',
      'http://127.0.0.1:3000/api/user',
      'http://127.0.0.1:8081/api/user',
      'HTTPS://LOCALHOST:8443/api/user',
      'http://localhost.:8443/api/user'
    ])('accepts %s', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_ORIGIN)).toBe(true)
    })

    it('accepts either spelling of loopback whichever one is configured', () => {
      expect(isConfiguredApiSiteUrl('http://localhost:3000/api/user', 'http://127.0.0.1:3000')).toBe(true)
      expect(isConfiguredApiSiteUrl('http://127.0.0.1:3000/api/user', 'http://localhost:3000')).toBe(true)
    })
  })

  describe('a host at or below the configured one', () => {
    it.each([
      `${CONFIGURED_DOMAIN}/api/user`,
      'https://api.example.com/api/user',
      'https://www.example.com/api/user',
      'https://eu.api.example.com/api/user',
      'http://api.example.com:8443/api/user'
    ])('accepts %s against a configured example.com', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_DOMAIN)).toBe(true)
    })

    it('accepts the bare domain when the www form is configured, and the www form either way', () => {
      expect(isConfiguredApiSiteUrl('https://example.com/api/user', 'https://www.example.com')).toBe(true)
      expect(isConfiguredApiSiteUrl('https://www.example.com/api/user', 'https://www.example.com')).toBe(true)
      expect(isConfiguredApiSiteUrl('https://www.example.com/api/user', 'https://example.com')).toBe(true)
    })

    it('accepts a subdomain under a multi-label public suffix', () => {
      expect(isConfiguredApiSiteUrl('https://api.example.co.uk/api/user', 'https://example.co.uk')).toBe(true)
    })
  })

  describe('a host that is neither the configured one nor below it', () => {
    it.each([
      'https://notexample.com/api/user',
      'https://example.com.evil.net/api/user',
      'https://example.com.evil.net:443/api/user',
      'https://unrelated.org/api/user',
      `${PRODUCTION_ORIGIN}/api/user`
    ])('rejects %s against a configured example.com', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_DOMAIN)).toBe(false)
    })

    // The case a "compare the last two labels" shortcut would let through, which is why whole label sequences
    // are compared and no public-suffix list is needed.
    it('rejects a sibling domain under a multi-label public suffix', () => {
      expect(isConfiguredApiSiteUrl('https://evil.co.uk/api/user', 'https://example.co.uk')).toBe(false)
    })

    it('rejects the parent of the configured host, because the rule is same host or below it', () => {
      expect(isConfiguredApiSiteUrl('https://example.com/api/user', 'https://api.example.com')).toBe(false)
    })

    it('rejects a www sibling rather than every host sharing the configured tail', () => {
      expect(isConfiguredApiSiteUrl('https://www.evil.com/api/user', 'https://www.example.com')).toBe(false)
    })
  })

  describe('a final URL no transport on this stack can report', () => {
    it.each([
      '',
      '   ',
      'localhost:3000/api/user',
      '//localhost:3000/api/user',
      'ftp://localhost:3000/api/user',
      'http://local host:3000/api/user',
      'http://localhost:99999/api/user',
      'http://[::1]:3000/api/user',
      'http://localhost。stateofhealthapi.com:3000/api/user',
      'http://localhost:3000/api/user\nHost: stateofhealthapi.com'
    ])('rejects %j', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })

    // Userinfo moves the host a URL parser resolves, so a final URL carrying any is refused rather than read.
    it.each([
      'http://user@localhost:3000/api/user',
      `${BACKSLASH_USERINFO_ORIGIN}/api/user`,
      'http://localhost:3000\\@stateofhealthapi.com/api/user',
      'http://localhost:3000@stateofhealthapi.com/api/user',
      'http://stateofhealthapi.com#@localhost:3000/api/user'
    ])('rejects %j', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })
  })

  describe('a configured origin the parser cannot read', () => {
    it.each(['', '   ', 'localhost:3000', 'ftp://localhost:3000', 'http://local host', 'http://localhost:99999'])(
      'is inert for %j instead of discarding every response the build receives',
      configuredOrigin => {
        expect(isConfiguredApiSiteUrl(`${PRODUCTION_ORIGIN}/api/user`, configuredOrigin)).toBe(true)
        expect(isConfiguredApiSiteUrl('http://localhost:3000/api/user', configuredOrigin)).toBe(true)
      }
    )
  })

  // The origin predicate is unchanged by this one existing: it still refuses everything its own rows say it
  // refuses, and these are the inputs where the two rules deliberately disagree.
  describe('the origin rule it does not replace', () => {
    it.each(['https://localhost:3000/api/user', 'http://localhost:8443/api/user', 'http://127.0.0.1:3000/api/user'])(
      'reads %s as the same site while the origin rule still refuses it',
      url => {
        expect(isConfiguredApiSiteUrl(url, CONFIGURED_ORIGIN)).toBe(true)
        expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
      }
    )

    it.each([
      `${PRODUCTION_ORIGIN}/api/user`,
      'http://notlocalhost:3000/api/user',
      'http://localhost.evil.com:3000/api/user',
      'http://user@localhost:3000/api/user',
      'localhost:3000/api/user'
    ])('refuses %j under both rules', url => {
      expect(isConfiguredApiSiteUrl(url, CONFIGURED_ORIGIN)).toBe(false)
      expect(isConfiguredApiOriginUrl(url, CONFIGURED_ORIGIN)).toBe(false)
    })

    it('accepts the configured origin itself under both rules', () => {
      expect(isConfiguredApiSiteUrl(`${CONFIGURED_ORIGIN}/api/user`, CONFIGURED_ORIGIN)).toBe(true)
      expect(isConfiguredApiOriginUrl(`${CONFIGURED_ORIGIN}/api/user`, CONFIGURED_ORIGIN)).toBe(true)
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
