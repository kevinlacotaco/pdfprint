import js from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import cspellESLintPluginRecommended from '@cspell/eslint-plugin/recommended';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import importPlugin from 'eslint-plugin-import';

export default defineConfig([
  globalIgnores(['src-tauri/', 'dist/', 'coverage/']),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '.prettierrc.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylistic,

  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  cspellESLintPluginRecommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  eslintPluginUnicorn.configs.recommended,

  {
    rules: {
      'import/order': 'error',
      'import/no-unresolved': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      '@cspell/spellchecker': [
        'warn',
        {
          checkComments: true,
          checkStringTemplates: true,
          checkStrings: true,
          numSuggestions: 3,
          checkIdentifiers: true,
          autoFix: false,
          customWordListFile: './spelling.txt',
        },
      ],
      'unicorn/no-null': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            kebabCase: true,
            pascalCase: true,
          },
          ignore: [String.raw`\.test\.tsx$`, String.raw`\.spec\.tsx$`],
        },
      ],
    },
  },
]);
