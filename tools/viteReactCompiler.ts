import { appendFileSync } from 'node:fs'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

/**
 * **React Compiler 켜는 범위** (r353 — 웹 전용, 원본에 없다).
 *
 * - **폴더**: 화면 그림 부품(`pages/<화면>/ui` · `widgets/<위젯>/ui` · `shared/ui` 의 .tsx)만. 게임 진행 훅(`app/model` ·
 *   `features/<기능>/model` · `pages/<화면>/model`)과 시험 파일은 뺀다 — 틱 시계 · 난수 굴림 차례 · 부수효과 차례가 원본과 같아야 한다.
 * - **방식**: `annotation` — 함수 머리에 `'use memo'` 를 단 부품만 컴파일한다. 폴더 전체를 `infer` 로 켜 보니(부품 · 훅 336개
 *   최적화, 99개 건너뜀) 그리는 동안 모듈 칸(고친 이름 표 · 버그 고치기 표 · 스프라이트 캐시 …)을 읽는 부품이 그 값을 props 에만
 *   묶어 메모해 낡은 값을 그렸다(`SpecialEditScreen` 이 고친 이름을 못 그림 — 시험이 잡음). 그래서 props 만으로 그리는 것이
 *   확인된 부품에만 단다. 달 때는 그 부품이 그리는 동안 모듈 칸 · ref · 시계를 읽지 않는지 본다.
 *
 * 재기: `REACT_COMPILER_LOG=<파일>` 이면 함수마다 컴파일 결과(성공 · 건너뜀 · 오류와 까닭)를 한 줄 JSON 으로 덧붙인다.
 * `REACT_COMPILER_MODE=infer` 면 폴더 안을 모두 컴파일하고, `off` 면 컴파일러를 끈다(재기 · 원인 좁히기 전용 — 배포 · 시험은 `annotation`).
 */
const COMPILED = ['**/src/pages/*/ui/**/*.tsx', '**/src/widgets/*/ui/**/*.tsx', '**/src/shared/ui/**/*.tsx']
const NOT_COMPILED = ['**/*.test.tsx', '**/model/**', '**/node_modules/**']

interface CompilerEvent {
  readonly kind: string
  readonly fnName?: string | null
  readonly fnLoc?: { readonly start?: { readonly line?: number } } | null
  readonly reason?: string
  readonly detail?: { readonly reason?: string; readonly options?: { readonly reason?: string } }
}

function compilerLogger(logFile: string | undefined) {
  if (logFile === undefined || logFile === '') return undefined
  return {
    logEvent(filename: string | null, event: CompilerEvent) {
      const reason = event.reason ?? event.detail?.reason ?? event.detail?.options?.reason ?? null
      const line = { file: filename, kind: event.kind, fn: event.fnName ?? null, at: event.fnLoc?.start?.line ?? null, reason }
      appendFileSync(logFile, `${JSON.stringify(line)}\n`)
    },
  }
}

export function reactCompiler(logFile: string | undefined, mode: string | undefined) {
  if (mode === 'off') return null
  const logger = compilerLogger(logFile)
  const compilationMode = mode === 'infer' ? 'infer' : 'annotation'
  const preset = reactCompilerPreset({ compilationMode, ...(logger === undefined ? {} : { logger }) })
  preset.rolldown.filter = { ...preset.rolldown.filter, id: { include: COMPILED, exclude: NOT_COMPILED } }
  // 프리셋은 브라우저 쪽 환경에만 붙는다 — vitest(node · jsdom 환경)에서도 같은 컴파일 결과를 시험하게 늘 붙인다
  preset.rolldown.applyToEnvironmentHook = () => true
  return babel({ presets: [preset] })
}
