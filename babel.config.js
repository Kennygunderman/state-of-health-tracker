module.exports = (api) => {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            [
                'module-resolver',
                {
                    extensions: ['.tsx', '.ts', '.js', '.json'],
                },
            ],
            'react-native-reanimated/plugin',
            [
                'module:react-native-dotenv',
                {
                    moduleName: '@env',
                    path: '.env',
                    allowlist: ['USDA_BASE_URL', 'USDA_FOOD_API_KEY'],
                },
            ],
        ],
    };
};
