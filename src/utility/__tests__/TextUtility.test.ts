import {capitalizeFirstLetterOfEveryWord, isNumber, lookupLabel, lookupMember} from '../TextUtility'

// The names an ordinary object literal answers to without ever being given them. A server code equal to any of
// these is what makes a raw `table[code]` return a function or an object instead of nothing.
const PROTOTYPE_KEYS = [
  'constructor',
  'toString',
  'toLocaleString',
  'valueOf',
  '__proto__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable'
]

type Recovery = 'refetchPlan' | 'reselectAlternative'

const RECOVERIES: readonly Recovery[] = ['refetchPlan', 'reselectAlternative']

describe('isNumber', () => {
  it('accepts a string of digits', () => {
    expect(isNumber('123')).toBe(true)
  })

  it('accepts a single digit', () => {
    expect(isNumber('0')).toBe(true)
  })

  it('accepts leading zeros', () => {
    expect(isNumber('007')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isNumber('')).toBe(false)
  })

  it('rejects decimals', () => {
    expect(isNumber('12.3')).toBe(false)
  })

  it('rejects negative numbers', () => {
    expect(isNumber('-5')).toBe(false)
  })

  it('rejects letters', () => {
    expect(isNumber('abc')).toBe(false)
  })

  it('rejects digits with surrounding whitespace', () => {
    expect(isNumber(' 123 ')).toBe(false)
  })
})

describe('capitalizeFirstLetterOfEveryWord', () => {
  it('capitalizes each word of a lowercase sentence', () => {
    expect(capitalizeFirstLetterOfEveryWord('hello world')).toBe('Hello World')
  })

  it('lowercases the rest of each word', () => {
    expect(capitalizeFirstLetterOfEveryWord('HELLO WORLD')).toBe('Hello World')
  })

  it('handles a single word', () => {
    expect(capitalizeFirstLetterOfEveryWord('bench')).toBe('Bench')
  })

  it('handles single-character words', () => {
    expect(capitalizeFirstLetterOfEveryWord('a b c')).toBe('A B C')
  })

  it('returns an empty string unchanged', () => {
    expect(capitalizeFirstLetterOfEveryWord('')).toBe('')
  })

  it('preserves multiple consecutive spaces', () => {
    expect(capitalizeFirstLetterOfEveryWord('hello  world')).toBe('Hello  World')
  })
})

describe('lookupLabel', () => {
  const LABELS: Record<string, string> = {produce: 'Produce', pantry_other: 'Pantry & other'}

  it('returns the copy an own key carries', () => {
    expect(lookupLabel(LABELS, 'produce')).toBe('Produce')
  })

  it('returns undefined for a code the table does not carry', () => {
    expect(lookupLabel(LABELS, 'frozen')).toBeUndefined()
  })

  it.each(PROTOTYPE_KEYS)('returns undefined for the inherited key %s', key => {
    expect(lookupLabel(LABELS, key)).toBeUndefined()
  })

  it('returns undefined for an inherited key even when the table is frozen', () => {
    const frozen: Record<string, string> = Object.freeze({produce: 'Produce'})

    expect(lookupLabel(frozen, 'toString')).toBeUndefined()
  })

  it('leaves the caller fallback reachable, which a raw index would not', () => {
    const inherited = 'toString'
    const rawIndex: unknown = LABELS[inherited] ?? null

    expect(typeof rawIndex).toBe('function')
    expect(lookupLabel(LABELS, inherited) ?? null).toBeNull()
  })

  it('returns an own value that shadows an inherited name', () => {
    const inherited = 'toString'
    const shadowing: Record<string, string> = {[inherited]: 'Shadowed copy'}

    expect(lookupLabel(shadowing, inherited)).toBe('Shadowed copy')
  })

  it('returns undefined for an own empty string, which is not renderable copy', () => {
    expect(lookupLabel({produce: ''}, 'produce')).toBeUndefined()
  })

  it('returns undefined for an own value that is not a string', () => {
    const malformed = {produce: 42} as unknown as Record<string, string>

    expect(lookupLabel(malformed, 'produce')).toBeUndefined()
  })

  it('returns undefined for an own value that is null or undefined', () => {
    expect(lookupLabel({produce: undefined}, 'produce')).toBeUndefined()
    expect(lookupLabel({produce: null} as unknown as Record<string, string>, 'produce')).toBeUndefined()
  })

  it('reads an empty table without throwing', () => {
    expect(lookupLabel({}, 'produce')).toBeUndefined()
    expect(lookupLabel({}, 'constructor')).toBeUndefined()
  })

  it('does not mutate the table it reads', () => {
    const table: Record<string, string> = {produce: 'Produce'}

    lookupLabel(table, 'constructor')
    lookupLabel(table, 'frozen')

    expect(table).toEqual({produce: 'Produce'})
    expect(Object.keys(table)).toEqual(['produce'])
  })
})

describe('lookupMember', () => {
  const TABLE: Partial<Record<string, Recovery>> = {stale_plan: 'refetchPlan', preview_stale: 'reselectAlternative'}

  it('returns the member an own key carries', () => {
    expect(lookupMember(TABLE, 'stale_plan', RECOVERIES)).toBe('refetchPlan')
    expect(lookupMember(TABLE, 'preview_stale', RECOVERIES)).toBe('reselectAlternative')
  })

  it('returns undefined for a code the table does not carry', () => {
    expect(lookupMember(TABLE, 'swap_failed', RECOVERIES)).toBeUndefined()
  })

  it.each(PROTOTYPE_KEYS)('returns undefined for the inherited key %s', key => {
    expect(lookupMember(TABLE, key, RECOVERIES)).toBeUndefined()
  })

  it('returns undefined for an own value outside the closed union', () => {
    const drifted = {stale_plan: 'rebootTheApp'} as unknown as Partial<Record<string, Recovery>>

    expect(lookupMember(drifted, 'stale_plan', RECOVERIES)).toBeUndefined()
  })

  it('returns undefined when the closed union is empty', () => {
    expect(lookupMember(TABLE, 'stale_plan', [])).toBeUndefined()
  })

  it('returns an own value that shadows an inherited name', () => {
    const inherited = 'valueOf'
    const shadowed: Recovery = 'reselectAlternative'
    const shadowing: Partial<Record<string, Recovery>> = {[inherited]: shadowed}

    expect(lookupMember(shadowing, inherited, RECOVERIES)).toBe('reselectAlternative')
  })

  it('does not mutate the table it reads', () => {
    const table: Partial<Record<string, Recovery>> = {stale_plan: 'refetchPlan'}

    lookupMember(table, '__proto__', RECOVERIES)

    expect(table).toEqual({stale_plan: 'refetchPlan'})
    expect(Object.keys(table)).toEqual(['stale_plan'])
  })
})
