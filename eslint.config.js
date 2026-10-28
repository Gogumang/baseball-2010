// ESLint 설정 (flat config) — 타입 정보 없는 가벼운 판(속도 우선). 포맷은 Prettier 가 맡는다(eslint-config-prettier).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { defineConfig } from 'eslint/config'
import { maxLinesBaseline } from './eslint.max-lines-baseline.js'

/** 코드만(주석 · 빈 줄 빼고) 150줄. 넘는 옛 파일은 `eslint.max-lines-baseline.js` 예외 목록 — 쪼개면 목록에서 뺀다 (`yarn check:lines`). */
const MAX_LINES = ['error', { max: 150, skipBlankLines: true, skipComments: true }]
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx']

export default defineConfig(
  { ignores: ['dist', 'base', 'public', '.yarn', '.pnp.cjs', '.pnp.loader.mjs', 'e2e/snapshots', 'e2e/fixtures', 'e2e/.run'] },
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.{js,mjs,ts}', 'tools/**/*.{js,mjs,ts}', '*.config.{ts,js}', 'eslint.max-lines-baseline.js'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'max-lines': MAX_LINES,
      'no-empty': ['error', { allowEmptyCatch: true }],
      // 주석만 있는 빈 case 는 일부러 흘려보내는 것 (예: 볼넷 · 사구 같은 밀어내기)
      'no-fallthrough': ['error', { allowEmptyCase: true }],
      // 안 쓰는 값은 `_` 로 시작하는 이름으로 둔다
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // 옛 코드에 있고 고치려면 코드를 바꿔야 하는 규칙 — 경고로 두고 조금씩 줄인다 (r343 도입 때 개수는 e2e/README.md)
      'no-useless-assignment': 'warn',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  { files: ['src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  {
    files: ['e2e/**', 'tools/**', '*.config.{ts,js}', 'eslint.max-lines-baseline.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    rules: {
      // React Compiler 계열 새 규칙 · 내보내기 규칙 — 옛 코드에 많다. 경고로 둔다 (동작을 바꾸는 수정은 따로)
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // 예외 처리는 `src/shared/lib/safe` 도우미(tryOr · tryOrElse · ignoreErrors · withFinally …)로 — 삼키는 자리가 이름으로 드러난다
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/lib/safe/**', ...TEST_FILES],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'TryStatement', message: 'try/catch 는 shared/lib/safe 도우미로 (tryOr · tryOrElse · ignoreErrors · withFinally …)' },
      ],
    },
  },
  { files: TEST_FILES, rules: { 'max-lines': 'off' } },
  { files: [...maxLinesBaseline, 'eslint.max-lines-baseline.js'], rules: { 'max-lines': 'off' } },
  prettier,
)
