import * as MealPlanLifecycleUtility from '../MealPlanLifecycleUtility'
import {
  isWriteAllowedByVerdict,
  isWriteRefusedByVerdict,
  isWriteVerdictUnknown,
  resolveEnvelopeWriteability
} from '../MealPlanLifecycleUtility'

describe('resolveEnvelopeWriteability', () => {
  it('carries the server’s verdict for a lifecycle it recognises', () => {
    expect(resolveEnvelopeWriteability('active', true)).toEqual({lifecycle: 'active', isWritable: true})
    expect(resolveEnvelopeWriteability('ended', false)).toEqual({lifecycle: 'ended', isWritable: false})
    expect(resolveEnvelopeWriteability('superseded', false)).toEqual({
      lifecycle: 'superseded',
      isWritable: false
    })
  })

  it('believes a server that refuses writes on a lifecycle it calls active', () => {
    // A future reason to close writes that this build has no word for must still close them.
    expect(resolveEnvelopeWriteability('active', false)).toEqual({lifecycle: 'active', isWritable: false})
  })

  it('never offers writes for a lifecycle this build does not recognise', () => {
    expect(resolveEnvelopeWriteability('frozen', true)).toEqual({lifecycle: 'superseded', isWritable: false})
    expect(resolveEnvelopeWriteability('', true)).toEqual({lifecycle: 'superseded', isWritable: false})
  })
})

describe('isWriteAllowedByVerdict', () => {
  it('allows the write only on an answered true', () => {
    expect(isWriteAllowedByVerdict(true)).toBe(true)
  })

  it('withholds it on an answered false', () => {
    expect(isWriteAllowedByVerdict(false)).toBe(false)
  })

  it('withholds it while the verdict is unknown, which is what the seeded envelope carries', () => {
    expect(isWriteAllowedByVerdict(null)).toBe(false)
    expect(isWriteAllowedByVerdict(undefined)).toBe(false)
  })
})

describe('isWriteRefusedByVerdict', () => {
  it('reports a refusal only on an answered false', () => {
    expect(isWriteRefusedByVerdict(false)).toBe(true)
  })

  it('does not call an unanswered verdict a refusal, so no screen says the plan is gone while it loads', () => {
    expect(isWriteRefusedByVerdict(null)).toBe(false)
    expect(isWriteRefusedByVerdict(undefined)).toBe(false)
  })

  it('does not call a writable plan a refusal', () => {
    expect(isWriteRefusedByVerdict(true)).toBe(false)
  })
})

describe('isWriteVerdictUnknown', () => {
  it('reports the unanswered states, which is what the seeded envelope and a missing envelope carry', () => {
    expect(isWriteVerdictUnknown(null)).toBe(true)
    expect(isWriteVerdictUnknown(undefined)).toBe(true)
  })

  it('reports nothing unknown once the server has answered either way', () => {
    expect(isWriteVerdictUnknown(true)).toBe(false)
    expect(isWriteVerdictUnknown(false)).toBe(false)
  })
})

describe('the three verdict states', () => {
  const VERDICTS: (boolean | null | undefined)[] = [true, false, null, undefined]

  it('classify every value into exactly one state', () => {
    VERDICTS.forEach(verdict => {
      const matches = [
        isWriteAllowedByVerdict(verdict),
        isWriteRefusedByVerdict(verdict),
        isWriteVerdictUnknown(verdict)
      ].filter(Boolean)

      expect(matches).toHaveLength(1)
    })
  })
})

/**
 * The reason this module has no function that takes a calendar day.
 *
 * Endedness is judged against the day of the user's SAVED IANA zone, which the AAP keeps as a home zone until
 * their next preferences save. After travel the device's day and the saved zone's day disagree, and at the
 * instant below a plan ending on the device's own day is already over in the saved zone — so a client that
 * derived the verdict from its own clock would offer a Swap and a Log the server refuses. Only the server's
 * answer moves the verdict, whichever way the device's day happens to fall.
 */
describe('the saved zone is the only zone the verdict may be judged in', () => {
  // 2026-06-15T02:00Z: a device in America/New_York reads 2026-06-14, while the saved Pacific/Auckland zone
  // reads 2026-06-15. For a plan whose last day is 2026-06-14 the device day says "still live" and the saved
  // zone says "finished".
  const INSTANT = new Date('2026-06-15T02:00:00.000Z')
  const dayKeyIn = (timeZone: string): string =>
    new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(INSTANT)

  const PLAN_END = '2026-06-14'

  it('is an instant the two zones genuinely disagree about', () => {
    // Guards the premise: if this ever stops holding, the cases below stop meaning anything.
    expect(dayKeyIn('America/New_York')).toBe('2026-06-14')
    expect(dayKeyIn('Pacific/Auckland')).toBe('2026-06-15')
    expect(dayKeyIn('America/New_York') > PLAN_END).toBe(false)
    expect(dayKeyIn('Pacific/Auckland') > PLAN_END).toBe(true)
  })

  it('exposes no derivation a device day could be fed into', () => {
    // The whole class of bug is removed by construction rather than handled: there is nothing here to call
    // with a day key, so no surface can reach an affirmative verdict without the server.
    expect(Object.keys(MealPlanLifecycleUtility).sort()).toEqual([
      'isWriteAllowedByVerdict',
      'isWriteRefusedByVerdict',
      'isWriteVerdictUnknown',
      'resolveEnvelopeWriteability'
    ])
  })

  it('refuses the write once the server has judged that instant in the saved zone', () => {
    // What the backend answers for this plan at this instant: ended in Pacific/Auckland, so not writable.
    const verdict = resolveEnvelopeWriteability('ended', false)

    expect(verdict).toEqual({lifecycle: 'ended', isWritable: false})
    expect(isWriteAllowedByVerdict(verdict.isWritable)).toBe(false)
    expect(isWriteRefusedByVerdict(verdict.isWritable)).toBe(true)
  })
})
