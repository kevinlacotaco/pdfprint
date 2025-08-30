import js from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import cspellESLintPluginRecommended from '@cspell/eslint-plugin/recommended';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.ts'],
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

  cspellESLintPluginRecommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  {
    rules: {
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
    },
  },
]);
