// Oxlint 설정 — 타입 정보 없는 가벼운 판(속도 우선). 포맷은 Oxfmt 가 맡는다.
// 옛 ESLint 설정(js · typescript-eslint recommended + react-hooks + react-refresh + 이 저장소 규칙)을 규칙 하나하나 옮겼다.
// oxlint 에 없는 규칙은 `tools/lint/localPlugin.mjs`(JS 플러그인)로.
import { defineConfig } from 'oxlint'
import { maxLinesBaseline } from './lint.max-lines-baseline.js'
import { readabilityBaseline, readabilityRules } from './lint.readability-baseline.js'
import { boundaryRules, crossSliceBaseline, cycleBaseline, layerDirectionBaseline } from './lint.boundaries-baseline.js'

/** 코드만(주석 · 빈 줄 빼고) 150줄. 넘는 옛 파일은 `lint.max-lines-baseline.js` 예외 목록 — 쪼개면 목록에서 뺀다 (`pnpm check:lines`). */
const MAX_LINES = ['error', { max: 150, skipBlankLines: true, skipComments: true }] as const
const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx']
const SRC = ['src/**/*.ts', 'src/**/*.tsx']
const BASELINE_FILES = ['lint.max-lines-baseline.js', 'lint.readability-baseline.js', 'lint.boundaries-baseline.js']

/** eslint recommended 가운데 TS 가 대신 잡아 typescript-eslint 가 .ts 에서 끄는 것 — .js · .mjs 에서만 켠다 */
const JS_ONLY_RULES = {
  'constructor-super': 'error',
  'getter-return': 'error',
  'no-class-assign': 'error',
  'no-const-assign': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-keys': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-new-native-nonconstructor': 'error',
  'no-obj-calls': 'error',
  'no-redeclare': ['error', { builtinGlobals: true }],
  'no-setter-return': 'error',
  'no-this-before-super': 'error',
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-unsafe-negation': 'error',
  'no-with': 'error',
} as const

/** typescript-eslint 가 .ts 에서 대신 켜는 것 */
const TS_ONLY_RULES = { 'no-var': 'error', 'prefer-rest-params': 'error', 'prefer-spread': 'error' } as const

export default defineConfig({
  // 기본 범주(correctness 경고 묶음)는 끄고, 옛 ESLint 가 켠 규칙만 아래에 적는다
  categories: { correctness: 'off' },
  plugins: ['eslint', 'typescript'],
  options: { reportUnusedDisableDirectives: 'error' },
  ignorePatterns: ['dist', 'base', 'public', 'tools/.venv'],
  rules: {
    // eslint recommended
    'for-direction': 'error',
    'no-async-promise-executor': 'error',
    'no-case-declarations': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': ['error', 'except-parens'],
    'no-constant-binary-expression': 'error',
    'no-constant-condition': ['error', { checkLoops: 'allExceptWhileTrue' }],
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-delete-var': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-empty-character-class': 'error',
    'no-empty-pattern': 'error',
    'no-empty-static-block': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    // 주석만 있는 빈 case 는 일부러 흘려보내는 것 (예: 볼넷 · 사구 같은 밀어내기)
    'no-fallthrough': ['error', { allowEmptyCase: true }],
    'no-global-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-nonoctal-decimal-escape': 'error',
    'no-prototype-builtins': 'error',
    'no-regex-spaces': 'error',
    'no-self-assign': ['error', { props: true }],
    'no-shadow-restricted-names': ['error', { reportGlobalThis: true }],
    'no-sparse-arrays': 'error',
    'no-unassigned-vars': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-unused-labels': 'error',
    'no-unused-private-class-members': 'error',
    'no-useless-backreference': 'error',
    'no-useless-catch': 'error',
    'no-useless-escape': 'error',
    'preserve-caught-error': 'error',
    'require-yield': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    // typescript-eslint recommended
    'typescript/ban-ts-comment': 'error',
    'no-array-constructor': 'error',
    'typescript/no-duplicate-enum-values': 'error',
    'typescript/no-empty-object-type': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/no-extra-non-null-assertion': 'error',
    'typescript/no-misused-new': 'error',
    'typescript/no-namespace': 'error',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/no-this-alias': 'error',
    'typescript/no-unnecessary-type-constraint': 'error',
    'typescript/no-unsafe-declaration-merging': 'error',
    'typescript/no-unsafe-function-type': 'error',
    'no-unused-expressions': 'error',
    // 안 쓰는 값은 `_` 로 시작하는 이름으로 둔다
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrors: 'all' }],
    'typescript/no-wrapper-object-types': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-namespace-keyword': 'error',
    'typescript/triple-slash-reference': 'error',
    // 이 저장소 규칙
    'max-lines': MAX_LINES,
    // 옛 코드에 있고 고치려면 코드를 바꿔야 하는 규칙 — 경고로 두고 조금씩 줄인다 (r343)
    'no-useless-assignment': 'warn',
    'prefer-const': ['error', { destructuring: 'all' }],
  },
  overrides: [
    { files: ['**/*.js', '**/*.mjs', '**/*.cjs'], rules: JS_ONLY_RULES },
    { files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'], rules: TS_ONLY_RULES },
    { files: SRC, env: { browser: true } },
    { files: ['tools/**', '*.config.ts', '*.config.js', ...BASELINE_FILES], env: { node: true, browser: true } },
    {
      // react-hooks recommended(React Compiler 규칙 포함) + react-refresh — oxlint 의 react 플러그인에 같은 이름으로 있다
      files: SRC,
      plugins: ['eslint', 'typescript', 'react'],
      rules: {
        'react/error-boundaries': 'error',
        'react/exhaustive-deps': 'warn',
        'react/incompatible-library': 'warn',
        'react/purity': 'error',
        'react/set-state-in-render': 'error',
        'react/static-components': 'error',
        'react/unsupported-syntax': 'warn',
        'react/use-memo': 'error',
        // React Compiler 계열 새 규칙 · 내보내기 규칙 — 옛 코드에 많다. 경고로 둔다 (동작을 바꾸는 수정은 따로)
        'react/rules-of-hooks': 'warn',
        'react/refs': 'warn',
        'react/set-state-in-effect': 'warn',
        'react/immutability': 'warn',
        'react/globals': 'warn',
        'react/preserve-manual-memoization': 'warn',
        'react/only-export-components': ['warn', { allowConstantExport: true, allowCompoundComponents: true }],
      },
    },
    {
      // 예외 처리는 `src/shared/lib/safe` 도우미(tryOr · tryOrElse · ignoreErrors · withFinally …)로 — 삼키는 자리가 이름으로 드러난다
      files: SRC,
      jsPlugins: ['./tools/lint/localPlugin.mjs'],
      rules: { 'local/no-try-statement': 'error' },
    },
    { files: ['src/shared/lib/safe/**', ...TEST_FILES], rules: { 'local/no-try-statement': 'off' } },
    // if 줄이기 — 갈래 8 · 블록 겹 2 · else-return · 외톨이 if · 콜백 겹 3. 어기는 옛 파일은 `lint.readability-baseline.js` 예외 목록
    { files: SRC, rules: readabilityRules },
    { files: [...TEST_FILES, ...readabilityBaseline], rules: Object.fromEntries(Object.keys(readabilityRules).map((rule) => [rule, 'off'])) },
    // FSD 층 경계 · 순환 import (r366) — 어기는 옛 파일은 `lint.boundaries-baseline.js` 의 규칙별 예외 목록, 시험 파일은 밖
    { files: SRC, plugins: ['eslint', 'typescript', 'import'], jsPlugins: ['./tools/lint/localPlugin.mjs'], rules: boundaryRules },
    { files: layerDirectionBaseline, rules: { 'local/fsd-layer-direction': 'off' } },
    { files: crossSliceBaseline, rules: { 'local/fsd-cross-slice': 'off' } },
    { files: cycleBaseline, rules: { 'import/no-cycle': 'off' } },
    { files: TEST_FILES, rules: { ...Object.fromEntries(Object.keys(boundaryRules).map((rule) => [rule, 'off'])), 'max-lines': 'off' } },
    { files: [...maxLinesBaseline, ...BASELINE_FILES], rules: { 'max-lines': 'off' } },
  ],
})
