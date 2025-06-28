import {isVersionGreaterOrEqual} from '../compareVersions'

describe('isVersionGreaterOrEqual', () => {
  test('returns false when version is less', () => {
    expect(isVersionGreaterOrEqual('1.4.3', '1.5.0')).toBe(false)
  })

  test('returns true when version is equal', () => {
    expect(isVersionGreaterOrEqual('1.5.0', '1.5.0')).toBe(true)
  })

  test('returns true when version is greater', () => {
    expect(isVersionGreaterOrEqual('1.6.0', '1.5.0')).toBe(true)
  })

  test('returns true when version has fewer segments but is effectively equal', () => {
    expect(isVersionGreaterOrEqual('1.5', '1.5.0')).toBe(true)
  })

  test('returns false when major version is less regardless of minor/patch', () => {
    expect(isVersionGreaterOrEqual('0.9.9', '1.0.0')).toBe(false)
  })

  test('returns true when major version is higher', () => {
    expect(isVersionGreaterOrEqual('44.4.5', '43.9.9')).toBe(true)
  })

  test('returns false when minor version is lower', () => {
    expect(isVersionGreaterOrEqual('44.3.5', '44.4.0')).toBe(false)
  })

  test('returns true when patch version is higher', () => {
    expect(isVersionGreaterOrEqual('44.4.5', '44.4.4')).toBe(true)
  })

  test('returns true when versions are equal with extra zeros', () => {
    expect(isVersionGreaterOrEqual('44.4.5.0', '44.4.5')).toBe(true)
  })

  test('returns false when major version is lower even if minor/patch are higher', () => {
    expect(isVersionGreaterOrEqual('43.10.10', '44.0.0')).toBe(false)
  })

  test('returns true when versions are exactly the same', () => {
    expect(isVersionGreaterOrEqual('44.4.5', '44.4.5')).toBe(true)
  })

  test('returns true when versions are exactly the same', () => {
    expect(isVersionGreaterOrEqual('44.4.5', '44.4.5')).toBe(true)
  })

  test('returns false when version has non-numeric parts and is less', () => {
    expect(isVersionGreaterOrEqual('1.beta.0', '1.0.1')).toBe(false)
  })

  test('returns false when version is empty', () => {
    expect(isVersionGreaterOrEqual('', '1.0.0')).toBe(false)
  })

  test('returns true when single digit version is equal', () => {
    expect(isVersionGreaterOrEqual('1', '1')).toBe(true)
  })

  test('returns false when single digit version is less', () => {
    expect(isVersionGreaterOrEqual('1', '2')).toBe(false)
  })

  test('returns true when single digit version is greater', () => {
    expect(isVersionGreaterOrEqual('2', '1')).toBe(true)
  })

  test('returns false when version is completely non-numeric', () => {
    expect(isVersionGreaterOrEqual('gjfisd', '1.5.4')).toBe(false)
  })

  test('returns true when second version is empty', () => {
    expect(isVersionGreaterOrEqual('1.2.3', '')).toBe(true)
  })
})
