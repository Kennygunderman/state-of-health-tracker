module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  ignorePatterns: ['node_modules/', 'coverage/', 'android/', 'ios/', 'jest-stare/'],
  plugins: ['import', 'prettier', 'react-hooks', '@typescript-eslint', 'unused-imports'],
  env: {
    jest: true,
    'jest/globals': true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json'
  },
  settings: {
    'import/ignore': ['react-native']
  },
  rules: {
    'prettier/prettier': ['error', require('./prettier.config')],
    'react/no-direct-mutation-state': 'error',
    'react/jsx-uses-vars': 'error',
    'no-undef': 'error',
    semi: 'off',
    'react/prop-types': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/display-name': 'warn',
    'react/jsx-newline': 'error',
    'comma-dangle': ['error', 'never'],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'import/no-unused-modules': 'error',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_'
      }
    ],
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        pathGroups: [
          {
            pattern: 'react',
            group: 'builtin',
            position: 'before'
          },
          {
            pattern: 'react-dom',
            group: 'builtin',
            position: 'before'
          },
          {
            pattern: 'react-native',
            group: 'builtin',
            position: 'before'
          },
          {
            pattern: '@screens/**',
            group: 'internal',
            position: 'before'
          },
          {
            pattern: '@components/**',
            group: 'internal',
            position: 'before'
          },
          {
            pattern: '@constants/**',
            group: 'internal',
            position: 'before'
          },
          {
            pattern: '@services/**',
            group: 'internal',
            position: 'before'
          },
          {
            pattern: '@types/**',
            group: 'internal',
            position: 'before'
          }
        ],
        pathGroupsExcludedImportTypes: ['react'],
        groups: [
          ['builtin', 'external', 'type'],
          ['sibling', 'object', 'internal', 'parent', 'index']
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    'padding-line-between-statements': [
      'warn',
      {
        blankLine: 'always',
        prev: ['const', 'let', 'var'],
        next: '*'
      },
      {
        blankLine: 'any',
        prev: ['const', 'let', 'var'],
        next: ['const', 'let', 'var']
      },
      {
        blankLine: 'always',
        prev: '*',
        next: ['class', 'return', 'export']
      }
    ],
    'import/no-named-as-default': 'off',
    'import/no-unresolved': 'off'
  },
  overrides: [
    {
      // Expo's base TSConfig excludes the root configuration JavaScript from the TypeScript program
      // (node_modules/expo/tsconfig.base.json lists jest.config.js, babel.config.js and metro.config.js, and a
      // dotfile never matches its wildcard), so project-aware parsing cannot resolve these three files: ESLint
      // reports each whole file as a parse error instead of linting it, and a changed-file lint run that
      // includes one of them can never exit 0. No rule configured here is type-aware, so dropping the program
      // for them costs no coverage.
      //
      // Scoped to the three this feature maintains rather than to every root config: metro.config.js is
      // untouched here and linting it would replace its recorded parse error with a different finding, which
      // the baseline gate would read as new.
      files: ['.eslintrc.js', 'babel.config.js', 'jest.config.js'],
      parserOptions: {project: null}
    }
  ]
}
