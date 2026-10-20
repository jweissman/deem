import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import noComments from 'eslint-plugin-no-comments';

export default defineConfig([
  { ignores: ['site/**', 'coverage/**', 'node_modules/**', 'doc/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js, '@stylistic': stylistic, 'no-comments': noComments },
    extends: ['js/recommended'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/no-empty-function': [
        'error',
        { allow: ['constructors'] },
      ],
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      curly: ['error', 'all'],
      'max-lines-per-function': [
        'error',
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      'max-lines': [
        'error',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-params': ['error', 4],
      'max-classes-per-file': ['error', 1],
      'no-console': 'off',
      'no-comments/disallowComments': 'off',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            ':not(MethodDefinition, PropertyDefinition) > FunctionDeclaration',
          message:
            'Stray function declarations are forbidden. Prefer methods inside a class.',
        },
        {
          selector:
            ':not(MethodDefinition, PropertyDefinition) > FunctionExpression',
          message:
            'Stray function expressions are forbidden. Prefer methods inside a class.',
        },
        {
          selector:
            ':not(MethodDefinition, PropertyDefinition, CallExpression, NewExpression, VariableDeclarator > ArrowFunctionExpression) > ArrowFunctionExpression',
          message:
            'Stray arrow functions are forbidden. Prefer methods inside a class.',
        },
        {
          selector: "VariableDeclarator[init.type='ArrowFunctionExpression']",
          message:
            'Assigning arrow functions to standalone variables is forbidden.',
        },
      ],
    },
  },
  {
    files: ['src/deem.ts', 'src/preview.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-params': 'off',
    },
  },
  {
    files: ['src/Template.ts', 'src/Generator.ts', 'src/Table.ts', 'src/stdlib.ts'],
    rules: {
      '@stylistic/max-len': ['error', { code: 160, tabWidth: 2, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'max-params': ['error', 6],
      'max-lines-per-function': ['error', { max: 160, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-restricted-syntax': 'off',
      'max-lines-per-function': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      '@typescript-eslint/no-unsafe-argument': 'off',
      'max-lines': [
        'error',
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ['bin/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-comments/disallowComments': 'off',
      'max-lines': 'off',
    },
  },
  {
    files: ['script/**/*.ts'],
    rules: {
      'no-console': 'off',
      'max-lines-per-function': ['error', { max: 60, IIFEs: true }],
    },
  },
  {
    files: ['eslint.config.mts'],
    rules: {
      'max-lines': 'off',
    },
  },
]);
