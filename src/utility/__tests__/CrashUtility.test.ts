import CrashUtility, {describeDecodeFailure, describeEndpoint} from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

// The native Crashlytics module does not exist under Jest, so the binding every assertion here reads is
// captured inside the factory — `jest.mock` is hoisted above every import in this file, so the module under
// test receives the fake — and re-exported on it for the test to reach.
jest.mock('@react-native-firebase/crashlytics', () => {
  const recordError = jest.fn()

  return {
    __esModule: true,
    default: () => ({recordError}),
    __recordError: recordError
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {__recordError: recordError} = require('@react-native-firebase/crashlytics')

// A response shaped like the ones this app decodes, so what a leak would look like is concrete: a meal name, a
// calorie target, a diary date, an entry id and a portion. The nutrition value is deliberately a string, which
// is what fails the codec below.
const PLAN_PAYLOAD = {
  id: 'plan-17',
  targets: {calories: 1940, protein: 146},
  day: {
    date: '2026-07-05',
    meals: [
      {
        name: 'Greek yogurt bowl',
        servings: 1.25,
        entryId: 'entry-4c1f',
        calories: 'four hundred and twenty'
      }
    ]
  }
}

// Real id shapes, because the classifier recognises shapes rather than names: both are v4 uuids, which is what
// every id this app puts in a path is (`@db.Uuid`).
const PLAN_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const ENTRY_ID = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

const PlanCodec = io.type({
  id: io.string,
  targets: io.type({calories: io.number, protein: io.number}),
  day: io.type({
    date: io.string,
    meals: io.array(io.type({name: io.string, servings: io.number, entryId: io.string, calories: io.number}))
  })
})

const failuresFor = (input: unknown): io.Errors => {
  const decoded = PlanCodec.decode(input)

  if (decoded._tag === 'Right') {
    throw new Error('expected the fixture to fail its codec')
  }

  return decoded.left
}

// Every value in the fixture, flattened. A leak of any one of them through the reported message is health data
// in telemetry (CWE-532), which is what these assertions are for.
const PAYLOAD_VALUES = [
  'plan-17',
  '1940',
  '146',
  '2026-07-05',
  'Greek yogurt bowl',
  '1.25',
  'entry-4c1f',
  'four hundred and twenty'
]

beforeEach(() => {
  recordError.mockClear()
})

describe('describeDecodeFailure', () => {
  it('names where the codec failed and what it expected there', () => {
    const description = describeDecodeFailure(failuresFor(PLAN_PAYLOAD))

    expect(description).toContain('day.meals.0.calories')
    expect(description).toContain('expected number')
  })

  // The canary. io-ts records an `actual` on every link of a failure's context chain — the root one being the
  // whole response body — so serialising the failures at all puts the payload into the message.
  it('reports no value from the payload, at any depth', () => {
    const description = describeDecodeFailure(failuresFor(PLAN_PAYLOAD))

    PAYLOAD_VALUES.forEach(value => expect(description).not.toContain(value))
    expect(description).not.toContain('actual')
  })

  it('reports nothing of a payload that is the wrong shape entirely', () => {
    const description = describeDecodeFailure(failuresFor({secret: 'Greek yogurt bowl', calories: 420}))

    expect(description).not.toContain('Greek yogurt bowl')
    expect(description).not.toContain('420')
    expect(description.length).toBeGreaterThan(0)
  })

  it('caps how many paths it reports and says how many it left out', () => {
    const ManyMembers = io.type(
      Object.fromEntries(Array.from({length: 12}, (_, index) => [`member${index}`, io.number]))
    )
    const decoded = ManyMembers.decode(Object.fromEntries(Array.from({length: 12}, (_, i) => [`member${i}`, 'x'])))

    if (decoded._tag === 'Right') {
      throw new Error('expected the fixture to fail its codec')
    }

    const description = describeDecodeFailure(decoded.left)

    expect(description.split(';').filter(part => part.includes('expected'))).toHaveLength(8)
    expect(description).toContain('+4 more')
  })

  it('collapses repeated paths so one malformed array is reported once', () => {
    const Items = io.type({items: io.array(io.type({value: io.number}))})
    const decoded = Items.decode({items: [{value: 'a'}, {value: 'b'}]})

    if (decoded._tag === 'Right') {
      throw new Error('expected the fixture to fail its codec')
    }

    const description = describeDecodeFailure(decoded.left)

    expect(description).toContain('items.0.value')
    expect(description).toContain('items.1.value')
  })
})

describe('describeEndpoint', () => {
  it('reports the templated route, not the URL that was requested', () => {
    expect(describeEndpoint(`https://api.example.com/api/meal-planning/plans/${PLAN_ID}/days/2026-07-05`)).toBe(
      '/api/meal-planning/plans/:id/days/:date'
    )
  })

  // The two exposures the review named in the path itself: a diary date says which day a person opened their
  // diary, and an entry id re-identifies one row across every report it appears in.
  it('redacts a diary date and a diary entry id', () => {
    expect(describeEndpoint('https://api.example.com/api/macros/2026-07-05')).toBe('/api/macros/:date')
    expect(describeEndpoint(`https://api.example.com/api/macros/entry/${ENTRY_ID}`)).toBe('/api/macros/entry/:id')
  })

  it('drops the query string, the fragment and the origin', () => {
    expect(describeEndpoint('https://api.example.com/api/catalog/foods?q=chicken%20thigh&page=2')).toBe(
      '/api/catalog/foods'
    )
    expect(describeEndpoint('http://localhost:3000/api/macros/2026-07-05#greek-yogurt')).toBe('/api/macros/:date')
    expect(describeEndpoint('/api/foods')).toBe('/api/foods')
  })

  it('keeps every static route word, so a report still names the operation', () => {
    expect(describeEndpoint(`http://x/api/meal-planning/plans/${PLAN_ID}/groceries/uncheck-all`)).toBe(
      '/api/meal-planning/plans/:id/groceries/uncheck-all'
    )
    expect(describeEndpoint('http://x/api/meal-planning/plans/current')).toBe('/api/meal-planning/plans/current')
    expect(describeEndpoint('http://x/api/weigh-ins')).toBe('/api/weigh-ins')
    // A wizard step names WHICH step failed, not the answer given there.
    expect(describeEndpoint('http://x/api/meal-planning/preferences/steps/targets_manual')).toBe(
      '/api/meal-planning/preferences/steps/targets_manual'
    )
  })

  it('redacts an id shape it does not recognise rather than reporting it', () => {
    expect(describeEndpoint('http://x/api/exercises/deadbeefcafe1234/history')).toBe('/api/exercises/:param/history')
    expect(describeEndpoint(`http://x/api/foods/${PLAN_ID.toUpperCase()}`)).toBe('/api/foods/:id')
    expect(describeEndpoint('http://x/api/foods/42')).toBe('/api/foods/:n')
    expect(describeEndpoint('http://x/api/foods/Greek%20yogurt%20bowl')).toBe('/api/foods/:param')
  })

  /**
   * The drift-proof assertion, and the reason this suite reads the real endpoint table instead of a list of
   * example URLs: every builder in `Endpoints` is driven with sentinel values and none of them may survive.
   * An endpoint a later change adds is covered the moment it is added, so this cannot quietly fall behind the
   * routes it is meant to bound.
   */
  it('lets no value from any endpoint in the real table reach the reported route', () => {
    const sentinels = [PLAN_ID, ENTRY_ID, '2026-07-05', 'Greek yogurt bowl', 'deadbeefcafe1234']

    Object.entries(Endpoints).forEach(([name, endpoint]) => {
      // Cast rather than typed per builder: the table mixes strings with builders of one to three parameters,
      // and the point of the sweep is to reach all of them without restating each signature.
      const urls =
        typeof endpoint === 'function'
          ? sentinels.map(sentinel =>
              (endpoint as (...args: unknown[]) => string)(...Array.from({length: endpoint.length}, () => sentinel))
            )
          : [endpoint]

      urls.forEach(url => {
        const route = describeEndpoint(url)

        sentinels.forEach(sentinel => {
          expect({endpoint: name, route}).toEqual({endpoint: name, route: expect.not.stringContaining(sentinel)})
        })
        // encodeURIComponent'd search terms must not survive in a different spelling either.
        expect(route).not.toContain('Greek')
        expect(route).not.toContain('2026')
      })
    })
  })
})

describe('CrashUtility.recordError', () => {
  it('reports an error once, however many layers catch and re-record it', () => {
    const error = new Error('boom')

    CrashUtility.recordError(error)
    CrashUtility.recordError(error)
    CrashUtility.recordError(error)

    expect(recordError).toHaveBeenCalledTimes(1)
    expect(recordError).toHaveBeenCalledWith(error)
  })

  it('reports a different error even after one has been reported', () => {
    CrashUtility.recordError(new Error('first'))
    CrashUtility.recordError(new Error('second'))

    expect(recordError).toHaveBeenCalledTimes(2)
  })

  it('still reports a thrown value that cannot carry a marker', () => {
    CrashUtility.recordError('a string rejection')
    CrashUtility.recordError('a string rejection')

    expect(recordError).toHaveBeenCalledTimes(2)
  })

  // The marker must not be visible to anything that walks the error: a `JSON.stringify` of a rejected value is
  // exactly the kind of place it would otherwise reappear.
  it('marks the error without adding an enumerable property', () => {
    const error = new Error('boom')

    CrashUtility.recordError(error)

    expect(Object.keys(error)).toEqual([])
    expect(JSON.stringify({...error})).not.toContain('Recorded')
  })
})

// The marker is module-private, so it is spelled out here: naming it is what lets these assertions distinguish
// the own property `recordError` writes from an identically named one reached through a prototype.
const RECORDED_FLAG = '__sohRecorded'

// `Object.prototype` is shared by every object in the process, so the flag is removed in a `finally`: a leak
// would silence recording for every test that runs afterwards, which is the exact failure being pinned here.
const withInheritedFlag = (assertions: () => void): void => {
  // eslint-disable-next-line no-extend-native -- extending Object.prototype is the condition under test
  Object.defineProperty(Object.prototype, RECORDED_FLAG, {value: true, enumerable: false, configurable: true})

  try {
    assertions()
  } finally {
    Reflect.deleteProperty(Object.prototype, RECORDED_FLAG)
  }
}

describe('CrashUtility.recordError — the marker is an own property', () => {
  // A plain member read of the flag resolves it through the prototype chain, so a single polluted
  // `Object.prototype.__sohRecorded` would make every error look already-reported and silence Crashlytics at
  // every call site in the app. Three distinct errors must still reach it.
  it('reports every distinct error while Object.prototype carries the flag', () => {
    const errors = [new Error('first'), new Error('second'), new Error('third')]

    withInheritedFlag(() => errors.forEach(error => CrashUtility.recordError(error)))

    expect(recordError).toHaveBeenCalledTimes(3)
    errors.forEach(error => expect(recordError).toHaveBeenCalledWith(error))
  })

  // The own marker written by the first call is what dedupes, and it still does while the inherited one exists.
  it('still reports one error once while Object.prototype carries the flag', () => {
    const error = new Error('boom')

    withInheritedFlag(() => {
      CrashUtility.recordError(error)
      CrashUtility.recordError(error)
    })

    expect(recordError).toHaveBeenCalledTimes(1)
  })

  it('reports an error that inherits the flag from its own prototype', () => {
    const error = Object.create({[RECORDED_FLAG]: true}) as object

    CrashUtility.recordError(error)

    expect(recordError).toHaveBeenCalledTimes(1)
    expect(recordError).toHaveBeenCalledWith(error)
  })

  // A rejected value is untrusted, so the ownership test may not be invoked on it: `error.hasOwnProperty(...)`
  // would throw here and lose the report it was called to make.
  it('reports an error whose own hasOwnProperty is not callable', () => {
    const error = new Error('boom')

    Object.defineProperty(error, 'hasOwnProperty', {value: 'not a function', enumerable: false, configurable: true})

    expect(() => CrashUtility.recordError(error)).not.toThrow()
    expect(recordError).toHaveBeenCalledTimes(1)
  })

  it('writes the marker as an own property no legacy consumer of the error can see', () => {
    const error = new Error('boom')

    CrashUtility.recordError(error)

    expect(Object.prototype.hasOwnProperty.call(error, RECORDED_FLAG)).toBe(true)
    expect(Object.keys(error)).toEqual([])
    expect(JSON.stringify({...error})).not.toContain(RECORDED_FLAG)
    expect(error instanceof Error).toBe(true)
  })
})

describe('CrashUtility.recordDecodeFailure', () => {
  // The route is read from the request rather than from the body, so the URL below deliberately shares no
  // value with the payload: every payload value must then be absent from the message, with nothing to argue
  // about. The URL's own ids and dates are redacted too — see the assertion that follows.
  it('reports the method and the failing codec paths, and no value from the body', () => {
    const error = CrashUtility.recordDecodeFailure(
      'GET',
      'https://api.example.com/api/meal-planning/plans/current?refresh=1',
      failuresFor(PLAN_PAYLOAD)
    )

    expect(error.message).toContain('GET')
    expect(error.message).toContain('/api/meal-planning/plans/current')
    expect(error.message).toContain('day.meals.0.calories')
    expect(error.message).not.toContain('refresh=1')
    PAYLOAD_VALUES.forEach(value => expect(error.message).not.toContain(value))
  })

  it('reports the templated route, so neither the ids nor the date in the URL reach the message', () => {
    const error = CrashUtility.recordDecodeFailure(
      'PUT',
      `https://api.example.com/api/meal-planning/plans/${PLAN_ID}/days/2026-07-05`,
      failuresFor({})
    )

    expect(error.message).toContain('PUT')
    expect(error.message).toContain('/api/meal-planning/plans/:id/days/:date')
    expect(error.message).not.toContain(PLAN_ID)
    expect(error.message).not.toContain('2026-07-05')
    expect(error.message).not.toContain('api.example.com')
  })

  it('records it once and returns it already marked, so a catching caller re-records nothing', () => {
    const error = CrashUtility.recordDecodeFailure('GET', 'https://api.example.com/api/foods', failuresFor({}))

    expect(recordError).toHaveBeenCalledTimes(1)
    expect(recordError).toHaveBeenCalledWith(error)

    CrashUtility.recordError(error)

    expect(recordError).toHaveBeenCalledTimes(1)
  })
})
