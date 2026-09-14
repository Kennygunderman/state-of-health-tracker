// `require.resolve` rather than a path string: the date helpers' daylight-saving coverage is only real while
// this environment applies, so a deleted or renamed environment must fail the whole run here instead of letting
// `*.dst.test.ts` fall back to the runner's own zone and keep passing without a transition to cross.
const dstTimeZoneEnvironment = require.resolve('./src/testSupport/dstTimeZoneEnvironment.ts')

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
