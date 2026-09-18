// Two projects, because one of the date helpers' guarantees cannot be observed in the runner's own zone. `mobile`
// is the suite as it has always run; `mobile-dst` runs every `*.dst.test.ts` file in a zone that observes daylight
// saving time and sits west of UTC, where a helper that advances by a fixed 24 hours, or that reads a
// 'yyyy-MM-dd' key as a UTC instant, returns the wrong calendar day. On CI the runner is UTC, so without this
// project those regressions pass unnoticed.
//
// The environment is referenced through `require.resolve` rather than as a path string on purpose: that coverage
// is only real while the environment applies, so a deleted or renamed environment must fail the whole run here
// instead of letting `*.dst.test.ts` fall back to the runner's zone and keep passing without a transition to
// cross. The DST suite's own docblock names the same module, and
// `src/utility/__tests__/MealPlanDateUtility.test.ts` asserts that this binding and both files are still here —
// so no piece of the pairing can be removed quietly.
const dstTimeZoneEnvironment = require.resolve('./src/testSupport/dstTimeZoneEnvironment.ts')

// Anchored on the extension so it matches the suffix and not a file merely containing it. The `mobile` project
// ignores it and the `mobile-dst` project claims it, which is what keeps every file in exactly one project.
const DST_TEST_SUFFIX = '\\.dst\\.test\\.ts$'

module.exports = {
  projects: [
    {
      displayName: 'mobile',
      preset: 'jest-expo',
      rootDir: __dirname,
      testPathIgnorePatterns: ['/node_modules/', DST_TEST_SUFFIX]
    },
    {
      displayName: 'mobile-dst',
      preset: 'jest-expo',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/**/*.dst.test.ts'],
      testEnvironment: dstTimeZoneEnvironment
    }
  ]
}
