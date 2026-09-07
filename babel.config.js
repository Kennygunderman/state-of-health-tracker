module.exports = function (api) {
  api.cache(true)

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@screens': './src/screens',
            '@components': './src/components',
            '@constants': './src/constants',
            '@services': './src/services',
            '@types': './src/types',
            '@styles': './src/styles',
            '@store': './src/store',
            '@data': './src/data',
            '@service': './src/service',
            '@queries': './src/queries',
            '@hooks': './src/hooks',
            '@utility': './src/utility',
            '@navigation': './src/navigation',
            '@assets': './src/assets'
          }
        }
      ],
      'react-native-worklets/plugin',
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          allowlist: ['SOH_API_BASE_URL']
        }
      ]
    ]
  }
}
