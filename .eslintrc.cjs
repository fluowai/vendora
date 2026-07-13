module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-console': 'warn',
    'no-empty': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
    'no-async-promise-executor': 'off',
    'no-constant-condition': 'off',
    'react/no-unescaped-entities': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/static-components': 'warn',
    'react-hooks/exhaustive-deps': 'off',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(error|_)$',
          varsIgnorePattern: '^([A-Z].*|error|_.*)$',
        }],
      },
    },
    {
      files: ['server.ts', 'server/**/*.ts', 'prisma/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['src/components/ErrorBoundary.tsx', 'src/hooks/useSocket.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['*.test.ts', '*.test.tsx', 'test/**/*.ts', 'test/**/*.tsx', 'test-api.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
  ],
};
