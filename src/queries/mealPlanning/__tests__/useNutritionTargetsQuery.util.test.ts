import {NutritionTargets} from '@data/models/NutritionTargets'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import {
  isLegacyTargetEditorOpen,
  isNutritionTargetsReadFailure,
  isNutritionTargetsRouteMissing,
  NutritionTargetsReadResult,
  resolveTargetAuthority,
  selectNutritionTargets,
  TargetAuthority,
  TargetAuthorityDecision,
  TargetAuthorityInput,
  targetAuthorityKey,
  TargetEditor
} from '../useNutritionTargetsQuery.util'

const TARGETS_PATH = '/meal-planning/targets'

const CONFIRMED_TARGETS: NutritionTargets = {
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  complete: true,
  source: 'manual',
  stale: false,
  revision: 3
}

// The server's answer for a user who has never confirmed a target: a successful read holding no figures. It is
// here to pin that the selector treats it as data, not as an unanswered read.
const UNCONFIRMED_TARGETS: NutritionTargets = {
  targets: null,
  complete: false,
  source: null,
  stale: false,
  revision: 0
}

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const ROUTE_MISSING_ERRORS: [string, unknown][] = [
  ['the typed RoutesMissingError the targets fetch throws', new RoutesMissingError(TARGETS_PATH)],
  ['an axios-shaped bare 404, the same answer before any classification', makeApiError(404)]
]

const READ_FAILURE_ERRORS: [string, unknown][] = [
  ['a 404 carrying a decodable code, the not-found answer of a resource route', makeApiError(404, 'not_found')],
  ['a 500 carrying a machine code', makeApiError(500, 'plan_generation_failed')],
  ['a network error with no response at all', new Error('network down')]
]

// A read that never answered: no data, and an error the displaying surface itself never reads.
const erroredResult = (error: unknown): NutritionTargetsReadResult => ({data: undefined, isError: true, error})

// The state TanStack actually leaves behind when a refetch fails after a successful read: `status` moves to
// 'error' and the last `data` is kept. It is the reason the selector classifies the whole result rather than
// just its data member.
const retainedDataResult = (error: unknown): NutritionTargetsReadResult => ({
  data: CONFIRMED_TARGETS,
  isError: true,
  error
})

const succeededResult = (data: NutritionTargets | undefined): NutritionTargetsReadResult => ({
  data,
  isError: false,
  error: null
})

// The two legacy accounts the target columns allow: they are independently nullable (AAP 0.5.2), so a set can
// hold a calorie figure with no macros, or macros with no calorie figure. Both are accounts the server holds
// targets for, however few.
const CALORIES_ONLY_TARGETS: NutritionTargets = {
  targets: {calories: 1900, protein: null, carbs: null, fat: null},
  complete: false,
  source: 'legacy',
  stale: false,
  revision: 0
}

const MACRO_ONLY_TARGETS: NutritionTargets = {
  targets: {calories: null, protein: 150, carbs: null, fat: null},
  complete: false,
  source: 'legacy',
  stale: false,
  revision: 0
}

// The retained-data state of a read whose last answer held no figures: the user who never opted in, now offline.
const retainedUnconfirmedResult = (error: unknown): NutritionTargetsReadResult => ({
  data: UNCONFIRMED_TARGETS,
  isError: true,
  error
})

const authedInput = (read: NutritionTargetsReadResult): TargetAuthorityInput => ({read, isAuthed: true})

const UNRESOLVED_DECISION: TargetAuthorityDecision = {
  authority: 'unresolved',
  editor: null,
  isEditable: false,
  serverCalories: null
}

const LEGACY_DECISION: TargetAuthorityDecision = {
  authority: 'local',
  editor: 'legacy',
  isEditable: true,
  serverCalories: null
}

const canonicalDecision = (serverCalories: number | null): TargetAuthorityDecision => ({
  authority: 'server',
  editor: 'canonical',
  isEditable: true,
  serverCalories
})

const EXPECTED_EDITOR: Record<TargetAuthority, TargetEditor | null> = {
  server: 'canonical',
  local: 'legacy',
  unresolved: null
}

const SIGNED_OUT_READS: [string, NutritionTargetsReadResult][] = [
  ['a read still in flight', succeededResult(undefined)],
  ['the token failure httpRequest throws', erroredResult(new Error('Bearer token is required for HTTP request'))],
  ['a read that still holds figures from the previous session', succeededResult(CONFIRMED_TARGETS)]
]

const authedInputsFrom = (
  state: string,
  errors: [string, unknown][],
  buildRead: (error: unknown) => NutritionTargetsReadResult
): [string, TargetAuthorityInput][] =>
  errors.map(([label, error]): [string, TargetAuthorityInput] => [`${state} (${label})`, authedInput(buildRead(error))])

// Every state the policy distinguishes, so the structural invariants are asserted over all of them rather than
// over whichever one happened to be written first.
const EVERY_AUTHORITY_INPUT: [string, TargetAuthorityInput][] = [
  ['a first load still in flight', authedInput(succeededResult(undefined))],
  ['an answered read holding no figures', authedInput(succeededResult(UNCONFIRMED_TARGETS))],
  ['a complete confirmed set', authedInput(succeededResult(CONFIRMED_TARGETS))],
  ['a calories-only legacy set', authedInput(succeededResult(CALORIES_ONLY_TARGETS))],
  ['a macro-only legacy set', authedInput(succeededResult(MACRO_ONLY_TARGETS))],
  ...SIGNED_OUT_READS.map(([label, read]): [string, TargetAuthorityInput] => [
    `a signed-out device with ${label}`,
    {read, isAuthed: false}
  ]),
  ...authedInputsFrom('a read failure that never answered', READ_FAILURE_ERRORS, erroredResult),
  ...authedInputsFrom('a read failure holding retained figures', READ_FAILURE_ERRORS, retainedDataResult),
  ...authedInputsFrom('a read failure holding a retained empty set', READ_FAILURE_ERRORS, retainedUnconfirmedResult),
  ...authedInputsFrom('a route-missing answer with no data', ROUTE_MISSING_ERRORS, erroredResult),
  ...authedInputsFrom('a route-missing answer with retained figures', ROUTE_MISSING_ERRORS, retainedDataResult)
]

describe('selectNutritionTargets', () => {
  it('returns the server targets when the read answered with them', () => {
    expect(selectNutritionTargets(succeededResult(CONFIRMED_TARGETS))).toBe(CONFIRMED_TARGETS)
  })

  it('returns a successful read that holds no figures as data, not as an absent answer', () => {
    expect(selectNutritionTargets(succeededResult(UNCONFIRMED_TARGETS))).toBe(UNCONFIRMED_TARGETS)
  })

  it('selects the local fallback when there is no data, which is every read that has not answered', () => {
    expect(selectNutritionTargets(succeededResult(undefined))).toBeNull()
  })

  it('selects the local fallback for a result carrying no data member at all', () => {
    expect(selectNutritionTargets({isError: false, error: null})).toBeNull()
  })

  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'selects the local fallback under %s when the read never produced data',
    (_label, error) => {
      expect(selectNutritionTargets(erroredResult(error))).toBeNull()
    }
  )

  // The case that made the plain `data ?? null` wrong: targets loaded, the backend was then rolled back past
  // `/meal-planning/targets*`, and TanStack kept the figures from before. That server holds no targets at all,
  // so the surface must degrade to the local value exactly as it does for a user who never opted in (AAP
  // 0.7.5) — while the Meal Plan segment, reading the same error, shows its unavailable card.
  describe('a route-missing answer arriving after a successful read', () => {
    it.each(ROUTE_MISSING_ERRORS)(
      'selects the local fallback under %s even though TanStack retained the figures',
      (_label, error) => {
        const result = retainedDataResult(error)

        expect(result.data).toBe(CONFIRMED_TARGETS)
        expect(selectNutritionTargets(result)).toBeNull()
      }
    )
  })

  // The deliberate other half of that rule: a 500 or a lost connection says nothing about whether the server
  // still holds these targets, so the last answer stays on screen and only the surface's retry affordance
  // (`isNutritionTargetsReadFailure`) reacts.
  describe('a generic read failure arriving after a successful read', () => {
    it.each(READ_FAILURE_ERRORS)('keeps the retained figures under %s', (_label, error) => {
      expect(selectNutritionTargets(retainedDataResult(error))).toBe(CONFIRMED_TARGETS)
    })
  })

  it('keeps the data of a succeeded result that still carries a previous route-missing error', () => {
    const result: NutritionTargetsReadResult = {
      data: CONFIRMED_TARGETS,
      isError: false,
      error: new RoutesMissingError(TARGETS_PATH)
    }

    expect(selectNutritionTargets(result)).toBe(CONFIRMED_TARGETS)
  })
})

describe('isNutritionTargetsRouteMissing', () => {
  it.each(ROUTE_MISSING_ERRORS)('is true for %s', (_label, error) => {
    expect(isNutritionTargetsRouteMissing({isError: true, error})).toBe(true)
  })

  it.each(READ_FAILURE_ERRORS)('is false for %s', (_label, error) => {
    expect(isNutritionTargetsRouteMissing({isError: true, error})).toBe(false)
  })

  it('is false on a successful result, where there is no error to classify', () => {
    expect(isNutritionTargetsRouteMissing({isError: false, error: null})).toBe(false)
  })

  it('is false on a succeeded result that still carries the previous error, which TanStack keeps', () => {
    expect(isNutritionTargetsRouteMissing({isError: false, error: new RoutesMissingError(TARGETS_PATH)})).toBe(false)
  })
})

describe('isNutritionTargetsReadFailure', () => {
  it.each(READ_FAILURE_ERRORS)('is true for %s, the failure a retry belongs to', (_label, error) => {
    expect(isNutritionTargetsReadFailure({isError: true, error})).toBe(true)
  })

  it.each(ROUTE_MISSING_ERRORS)('is false for %s, which no retry can resolve', (_label, error) => {
    expect(isNutritionTargetsReadFailure({isError: true, error})).toBe(false)
  })

  it('is false on a successful result', () => {
    expect(isNutritionTargetsReadFailure({isError: false, error: null})).toBe(false)
  })

  it('is false on a succeeded result that still carries the previous error', () => {
    expect(isNutritionTargetsReadFailure({isError: false, error: makeApiError(500, 'plan_generation_failed')})).toBe(
      false
    )
  })
})

describe('the two predicates together', () => {
  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'classifies %s as exactly one of route-missing and read failure',
    (_label, error) => {
      const result = {isError: true, error}

      expect(isNutritionTargetsRouteMissing(result)).not.toBe(isNutritionTargetsReadFailure(result))
    }
  )

  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'reports neither for %s once the read has succeeded, because both key on isError',
    (_label, error) => {
      const result = {isError: false, error}

      expect(isNutritionTargetsRouteMissing(result)).toBe(false)
      expect(isNutritionTargetsReadFailure(result)).toBe(false)
    }
  )
})

describe('resolveTargetAuthority', () => {
  // Nothing may be edited while it is unknown who owns the target: the legacy modal would write a device value
  // the server's own targets then override everywhere else, and the canonical editor would push a user who
  // never opted in through the planner's writer.
  describe('a read that has not answered', () => {
    it('leaves the authority unresolved while the first load is in flight', () => {
      expect(resolveTargetAuthority(authedInput(succeededResult(undefined)))).toEqual(UNRESOLVED_DECISION)
    })

    it.each(READ_FAILURE_ERRORS)(
      'leaves the authority unresolved under %s, which failed before the read ever produced data',
      (_label, error) => {
        expect(resolveTargetAuthority(authedInput(erroredResult(error)))).toEqual(UNRESOLVED_DECISION)
      }
    )
  })

  // A 500 or a lost connection says nothing about who owns the target, so the retained answer keeps deciding:
  // an offline opted-in user keeps the canonical editor, an offline never-opted-in user keeps the legacy modal.
  describe('a generic read failure that kept its last answer', () => {
    it.each(READ_FAILURE_ERRORS)('keeps the canonical editor and the retained calories under %s', (_label, error) => {
      expect(resolveTargetAuthority(authedInput(retainedDataResult(error)))).toEqual(canonicalDecision(1940))
    })

    it.each(READ_FAILURE_ERRORS)(
      'keeps the legacy modal under %s when the retained answer held no figures',
      (_label, error) => {
        expect(resolveTargetAuthority(authedInput(retainedUnconfirmedResult(error)))).toEqual(LEGACY_DECISION)
      }
    )
  })

  // A backend rolled back past `/meal-planning/targets*` holds no server targets at all, so these surfaces
  // degrade to the local value exactly as they behave for a user who never opted in (AAP 0.7.5) — including
  // when TanStack still holds the figures read before the rollback.
  describe('a backend rolled back past the targets route', () => {
    it.each(ROUTE_MISSING_ERRORS)(
      'routes to the legacy modal under %s when the read produced no data',
      (_label, error) => {
        expect(resolveTargetAuthority(authedInput(erroredResult(error)))).toEqual(LEGACY_DECISION)
      }
    )

    it.each(ROUTE_MISSING_ERRORS)(
      'routes to the legacy modal under %s despite the retained figures',
      (_label, error) => {
        const read = retainedDataResult(error)

        expect(read.data).toBe(CONFIRMED_TARGETS)
        expect(resolveTargetAuthority(authedInput(read))).toEqual(LEGACY_DECISION)
      }
    )
  })

  describe('a read the server answered', () => {
    it('routes a user who has never confirmed a target to the legacy modal', () => {
      expect(resolveTargetAuthority(authedInput(succeededResult(UNCONFIRMED_TARGETS)))).toEqual(LEGACY_DECISION)
    })

    it('routes a complete confirmed set to the canonical editor with its calories', () => {
      expect(resolveTargetAuthority(authedInput(succeededResult(CONFIRMED_TARGETS)))).toEqual(canonicalDecision(1940))
    })

    it('routes a calories-only legacy set to the canonical editor with those calories', () => {
      expect(resolveTargetAuthority(authedInput(succeededResult(CALORIES_ONLY_TARGETS)))).toEqual(
        canonicalDecision(1900)
      )
    })

    // The case a calories-only predicate gets wrong: the server holds this account's protein target, so the
    // canonical editor owns it, and the surface shows its local calorie figure through `serverCalories ?? local`.
    it('routes a macro-only legacy set, which a calories-only predicate misreads as local, to the canonical editor with no server calories', () => {
      expect(resolveTargetAuthority(authedInput(succeededResult(MACRO_ONLY_TARGETS)))).toEqual(canonicalDecision(null))
    })
  })

  // A device with no session holds no server targets and cannot acquire any — `httpRequest` throws
  // "Bearer token is required for HTTP request" before reaching the network — so signed-out behaviour stays
  // exactly what it was: the local target, edited in the legacy modal (AAP 0.1.4).
  describe('a signed-out device', () => {
    it.each(SIGNED_OUT_READS)('keeps the legacy modal with %s', (_label, read) => {
      expect(resolveTargetAuthority({read, isAuthed: false})).toEqual(LEGACY_DECISION)
    })
  })

  // The three members no consumer should have to re-derive, asserted over every state above so none of them can
  // drift into contradicting its own authority.
  describe('the members of every decision', () => {
    it.each(EVERY_AUTHORITY_INPUT)('is editable for %s exactly when the authority is resolved', (_label, input) => {
      const decision = resolveTargetAuthority(input)

      expect(decision.isEditable).toBe(decision.authority !== 'unresolved')
      expect(decision.editor === null).toBe(decision.authority === 'unresolved')
    })

    it.each(EVERY_AUTHORITY_INPUT)('names the writer that owns the authority for %s', (_label, input) => {
      const decision = resolveTargetAuthority(input)

      expect(decision.editor).toBe(EXPECTED_EDITOR[decision.authority])
    })

    it.each(EVERY_AUTHORITY_INPUT)(
      'reports a server calorie figure only under server authority for %s',
      (_label, input) => {
        const decision = resolveTargetAuthority(input)

        expect(decision.authority !== 'server' && decision.serverCalories !== null).toBe(false)
      }
    )
  })
})

// The legacy modal outlives the press that opened it, so the press-time decision is not the whole guard: these
// two helpers are what the surfaces ask on every render, and the transitions below are the states a press can
// never observe.
describe('isLegacyTargetEditorOpen', () => {
  it.each(EVERY_AUTHORITY_INPUT)('is closed until the user asks for it, with %s', (_label, input) => {
    expect(isLegacyTargetEditorOpen(resolveTargetAuthority(input), false)).toBe(false)
  })

  it.each(EVERY_AUTHORITY_INPUT)('opens on request with %s only where the device owns the target', (_label, input) => {
    const decision = resolveTargetAuthority(input)

    expect(isLegacyTargetEditorOpen(decision, true)).toBe(decision.editor === 'legacy')
  })

  // The loss the press-time check cannot prevent: the modal is open because this user had no server targets,
  // another device confirms some, and the next read answers with them. Its button writes the device value
  // alone, so it has to be gone before it can be pressed (AAP 0.1.4).
  it('closes a standing request once the read answers with server targets', () => {
    const openedUnderLocal = resolveTargetAuthority(authedInput(succeededResult(UNCONFIRMED_TARGETS)))

    expect(isLegacyTargetEditorOpen(openedUnderLocal, true)).toBe(true)
    expect(
      isLegacyTargetEditorOpen(resolveTargetAuthority(authedInput(succeededResult(CONFIRMED_TARGETS))), true)
    ).toBe(false)
    expect(
      isLegacyTargetEditorOpen(resolveTargetAuthority(authedInput(succeededResult(MACRO_ONLY_TARGETS))), true)
    ).toBe(false)
  })

  it('closes a standing request while the authority is unresolved, where neither writer may run', () => {
    expect(isLegacyTargetEditorOpen(resolveTargetAuthority(authedInput(succeededResult(undefined))), true)).toBe(false)
  })

  // The transition that must NOT close it: a rolled-back backend leaves the device in charge of the target
  // (AAP 0.7.5), so the writer the user is already using stays available.
  it.each(ROUTE_MISSING_ERRORS)('stays open under %s, which leaves the device in charge', (_label, error) => {
    expect(isLegacyTargetEditorOpen(resolveTargetAuthority(authedInput(erroredResult(error))), true)).toBe(true)
    expect(isLegacyTargetEditorOpen(resolveTargetAuthority(authedInput(retainedDataResult(error))), true)).toBe(true)
  })
})

describe('targetAuthorityKey', () => {
  it.each(EVERY_AUTHORITY_INPUT)('names the authority in force for %s', (_label, input) => {
    const decision = resolveTargetAuthority(input)

    expect(targetAuthorityKey(decision)).toBe(decision.editor ?? decision.authority)
  })

  // Remounting Account's row is how an authority change closes a modal owned by a component this feature may
  // not modify, so the key has to change on every transition between authorities...
  it('differs between the three authorities, so any transition remounts the row', () => {
    const keys = [
      targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(CONFIRMED_TARGETS)))),
      targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(UNCONFIRMED_TARGETS)))),
      targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(undefined))))
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })

  // ...and must not change for anything else, or a background refetch would remount the row on every render.
  it('is identical for different reads that resolve to the same authority', () => {
    expect(targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(UNCONFIRMED_TARGETS))))).toBe(
      targetAuthorityKey(resolveTargetAuthority({read: succeededResult(CONFIRMED_TARGETS), isAuthed: false}))
    )

    expect(targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(CONFIRMED_TARGETS))))).toBe(
      targetAuthorityKey(resolveTargetAuthority(authedInput(succeededResult(MACRO_ONLY_TARGETS))))
    )
  })
})
