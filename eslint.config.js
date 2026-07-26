import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

// Flat config. Type-aware linting is deliberately off: `vue-tsc --noEmit`
// (npm run compile) already type-checks everything including .vue SFCs, so the
// extra project-service pass would only slow CI down for the same errors.
export default ts.config(
  { ignores: ['.output/**', '.wxt/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
    },
  },
  {
    rules: {
      // WXT injects defineBackground/defineContentScript as globals.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Single-word component names are fine for an app this size (WordPopup,
      // CardPreview are already multi-word; this only bites on future ones).
      'vue/multi-word-component-names': 'off',
    },
  },
  prettier,
);
