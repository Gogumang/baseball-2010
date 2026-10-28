#!/usr/bin/env node
// 읽기 좋은 코드 규칙 예외 목록 검사 — `lint.readability-baseline.js` 의 파일이 아직 규칙(complexity · max-depth …)을 어기는지 본다.
//   pnpm check:lines           목록에서 빠져야 할 파일(위반 0 · 없는 파일)이 있으면 실패
//   pnpm check:lines --update  그런 파일을 목록에서 빼고 이름만 알파벳 순으로 다시 쓴다(새 파일은 넣지 않는다)
// 혼자 돌려도 된다: `node tools/check-readability-baseline.mjs [--update]`.
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { readabilityRules } from '../lint.readability-baseline.js'
import { readBaselineFiles, writeBaselineFiles } from './lint/baselineList.mjs'
import { oxlintDiagnostics } from './lint/oxlintCounts.mjs'

const BASELINE = 'lint.readability-baseline.js'
const RULES = new Set(Object.keys(readabilityRules))

/** 다섯 규칙 중 하나라도 어기는 파일들 */
export function readabilityViolators(files) {
  const violators = new Set()
  for (const [file, list] of oxlintDiagnostics(readabilityRules, files)) {
    if (list.some(({ rule }) => RULES.has(rule))) violators.add(file)
  }
  return violators
}

/** 목록 검사(또는 `update` 면 다시 쓰기). 빼야 할 파일 수를 낸다 */
export async function checkReadabilityBaseline({ update }) {
  const listed = readBaselineFiles(BASELINE)
  const present = listed.filter((file) => existsSync(file))
  const missing = listed.filter((file) => !existsSync(file))
  const violators = present.length === 0 ? new Set() : readabilityViolators(present)
  const clean = present.filter((file) => !violators.has(file))

  if (update) {
    const keep = present.filter((file) => violators.has(file))
    writeBaselineFiles(BASELINE, 'readabilityBaseline', keep)
    console.log(`${BASELINE}: ${keep.length}개로 다시 썼다 (뺀 것 ${listed.length - keep.length})`)
    return 0
  }
  for (const file of missing) console.log(`없는 파일 — 목록에서 빼세요: ${file}`)
  for (const file of clean) console.log(`읽기 규칙 위반 0 — 목록에서 빼세요: ${file}`)
  const failed = missing.length + clean.length
  console.log(`읽기 규칙 예외 ${listed.length}개 · 뺄 것 ${failed}개${failed > 0 ? ' — `pnpm check:lines --update` 로 뺀다' : ''}`)
  return failed
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit((await checkReadabilityBaseline({ update: process.argv.includes('--update') })) > 0 ? 1 : 0)
}
