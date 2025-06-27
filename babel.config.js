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
            '@theme': './src/styles',
            '@store': './src/store',
            '@data': './src/data',
            '@service': './src/service'
          }
        }
      ],
      'react-native-reanimated/plugin',
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          allowlist: ['USDA_BASE_URL', 'USDA_FOOD_API_KEY', 'SOH_API_KEY', 'SOH_API_BASE_URL']
        }
      ]
    ]
  }
}
