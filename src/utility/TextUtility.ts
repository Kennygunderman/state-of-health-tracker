export const isNumber = (text: string) => /^\d+$/.test(text)

export const capitalizeFirstLetterOfEveryWord = (text: string) =>
  text
    .toLowerCase()
    .split(' ')
    .map(s => s.charAt(0).toUpperCase() + s.substring(1))
    .join(' ')

// Every copy table in @constants/strings is an ordinary object literal, so it inherits Object.prototype:
// indexing one with a code that arrived from the server resolves inherited members — 'constructor',
// 'toString', 'valueOf', '__proto__' — to functions and objects rather than to nothing. A caller's
// `?? fallback` then never fires, because an inherited member is not nullish, and a value that is not copy at
// all reaches the UI in place of the unknown-code text the caller wrote. Object.freeze does not help; only an
// own-property check does. These two helpers are the sanctioned way to read such a table with a code this
// build may never have heard of.
const hasOwnEntry = (table: object, code: string): boolean => Object.prototype.hasOwnProperty.call(table, code)

const isMember = <T extends string>(value: unknown, members: readonly T[]): value is T =>
  members.some(member => member === value)

// Undefined both for an absent code and for a present-but-unrenderable value, so the caller's `?? fallback`
// or `=== undefined` branch is reached in every case the table cannot answer with copy.
export function lookupLabel(table: Partial<Record<string, string>>, code: string): string | undefined {
  if (!hasOwnEntry(table, code)) {
    return undefined
  }

  const value: unknown = table[code]

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// The same guard for a table whose values are a closed union rather than free copy. Membership is re-checked
// at runtime because the annotation describes what the table was authored with, never what indexing it by an
// unvalidated code can return.
export function lookupMember<T extends string>(
  table: Partial<Record<string, T>>,
  code: string,
  members: readonly T[]
): T | undefined {
  if (!hasOwnEntry(table, code)) {
    return undefined
  }

  const value: unknown = table[code]

  return isMember(value, members) ? value : undefined
}
