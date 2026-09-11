import {TestEnvironment as NodeTestEnvironment} from 'jest-environment-node'

const DST_TIME_ZONE = 'America/New_York'

/**
 * Runs a single test file in a zone that observes daylight saving time, so that calendar arithmetic
 * meets a real transition instead of UTC's uniform day.
 *
 * Jest hands test code a copy of `process.env`, so assigning `TZ` from inside a test never retunes
 * `Date`: the variable has to be set on the real process before the sandbox is built, which is what
 * this environment does. The previous value is restored on teardown, so the zone lives for exactly
 * one file and no suite that runs afterwards in the same worker observes it.
 *
 * It sits outside `__tests__` because Jest collects every file it finds there, and the default
 * collection patterns are left alone. Select it per file with
 * `@jest-environment <rootDir>/src/testSupport/dstTimeZoneEnvironment.ts`.
 */
export default class DstTimeZoneEnvironment extends NodeTestEnvironment {
  customExportConditions = ['require', 'react-native']

  private previousTimeZone: string | undefined

  async setup(): Promise<void> {
    // Reached through a reference because babel's react-native-dotenv plugin rewrites any literal
    // `process.env.<KEY>` whose key is set at launch, which would turn the assignment below into one
    // against a string literal and fail the transform
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
