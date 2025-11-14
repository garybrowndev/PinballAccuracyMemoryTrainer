import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
    },
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Code Quality & Best Practices
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'warn',
      'curly': ['error', 'all'],
      'default-case': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-return-await': 'error',
      // React-Specific
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': ['error', 'never'],
      // Code Style & Consistency
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      'arrow-spacing': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      // Error Prevention
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-shadow': 'warn',
      'no-param-reassign': 'error',
      'array-callback-return': 'error',
      'consistent-return': 'warn',
      // React Hooks
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]);
