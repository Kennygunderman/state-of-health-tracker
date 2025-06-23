module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'android/',
    'ios/',
    'jest-stare/'
  ],
  plugins: [
    'import',
    'prettier',
    'react-hooks',
    '@typescript-eslint',
    'unused-imports'
  ],
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
    'prettier/prettier': 'error',
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
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
    ],
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        pathGroups: [
          { pattern: 'react', group: 'builtin', position: 'before' },
          { pattern: 'react-dom', group: 'builtin', position: 'before' },
          { pattern: 'react-native', group: 'builtin', position: 'before' },
          { pattern: '@screens/**', group: 'internal', position: 'before' },
          { pattern: '@components/**', group: 'internal', position: 'before' },
          { pattern: '@constants/**', group: 'internal', position: 'before' },
          { pattern: '@services/**', group: 'internal', position: 'before' },
          { pattern: '@types/**', group: 'internal', position: 'before' }
        ],
        pathGroupsExcludedImportTypes: ['react'],
        groups: [
          ['builtin', 'external', 'type'],
          ['sibling', 'object', 'internal', 'parent', 'index']
        ],
        alphabetize: { order: 'asc', caseInsensitive: true }
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
  }
} 