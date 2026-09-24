import {TestEnvironment as NodeTestEnvironment} from 'jest-environment-node'

const DST_TIME_ZONE = 'America/New_York'

/**
 * Runs a single test file in a zone that observes daylight saving time and sits west of UTC, so that day-key
 * arithmetic meets a real transition and a real negative offset instead of UTC's uniform 24-hour day. Without
 * it a helper that advanced by a fixed 24 hours, or that read a day key as a UTC instant, passes every suite.
 *
 * Jest hands test code a copy of `process.env`, so assigning `TZ` from inside a test never retunes `Date`: the
 * variable has to be set on the real process before the sandbox is built, which is what this environment does.
 * The previous value is restored on teardown, so the zone lives for exactly one file and no suite that runs
 * afterwards in the same worker observes it.
 *
 * `customExportConditions` repeats what `@react-native/jest-preset`'s own environment sets — the environment
 * `jest-expo` resolves for every other suite — so the zone is the only difference between them.
 *
 * It sits outside `__tests__` because Jest collects every file it finds there, and the preset's collection
 * patterns are left alone. `jest.config.js` binds it to `*.dst.test.ts` by configuration; the pragma those
 * files carry states the same pairing where a reader meets it.
 */
export default class DstTimeZoneEnvironment extends NodeTestEnvironment {
  customExportConditions = ['require', 'react-native']

  private previousTimeZone: string | undefined

  async setup(): Promise<void> {
    // Reached through a reference because babel's react-native-dotenv plugin replaces any literal
    // `process.env.<KEY>` whose key is defined at transform time with that key's value, which would turn the
    // assignment below into one against a string literal on any machine that exports TZ
    const nodeEnvironment = process.env

    this.previousTimeZone = nodeEnvironment.TZ
    nodeEnvironment.TZ = DST_TIME_ZONE

    await super.setup()
  }

  async teardown(): Promise<void> {
    await super.teardown()

    const nodeEnvironment = process.env

    if (this.previousTimeZone === undefined) delete nodeEnvironment.TZ
    else nodeEnvironment.TZ = this.previousTimeZone
  }
}
