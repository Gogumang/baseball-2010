#!/usr/bin/env node
// 150줄 예외 목록 검사 — `lint.max-lines-baseline.js` 의 파일이 아직 150줄(코드만)을 넘는지 본다.
//   pnpm check:lines           목록에서 빠져야 할 파일(150 이하 · 없는 파일)이 있으면 실패
//   pnpm check:lines --update  그런 파일을 목록에서 빼고 이름만 알파벳 순으로 다시 쓴다(새 파일은 넣지 않는다)
// 줄 수는 oxlint max-lines 와 같은 셈(빈 줄 · 주석 빼고) — 그 규칙을 그대로 돌려 150 을 넘는 파일만 받는다.
// 읽기 좋은 코드 규칙 예외 목록(`lint.readability-baseline.js`)도 같은 명령에서 본다 (`check-readability-baseline.mjs`).
import { existsSync } from 'node:fs'
import { checkReadabilityBaseline } from './check-readability-baseline.mjs'
import { readBaselineFiles, writeBaselineFiles } from './lint/baselineList.mjs'
import { oxlintDiagnostics } from './lint/oxlintCounts.mjs'

const BASELINE = 'lint.max-lines-baseline.js'
const MAX = 150
const update = process.argv.includes('--update')

const listed = readBaselineFiles(BASELINE)
const present = listed.filter((file) => existsSync(file))
const missing = listed.filter((file) => !existsSync(file))

const overMax = oxlintDiagnostics({ 'max-lines': ['error', { max: MAX, skipBlankLines: true, skipComments: true }] }, present)
const shrunk = present.filter((file) => !overMax.has(file))

if (update) {
  const keep = present.filter((file) => overMax.has(file))
  writeBaselineFiles(BASELINE, 'maxLinesBaseline', keep)
  console.log(`${BASELINE}: ${keep.length}개로 다시 썼다 (뺀 것 ${listed.length - keep.length})`)
  await checkReadabilityBaseline({ update: true })
  process.exit(0)
}

for (const file of missing) console.log(`없는 파일 — 목록에서 빼세요: ${file}`)
for (const file of shrunk) console.log(`${MAX}줄 이하 — 목록에서 빼세요: ${file}`)
const failed = missing.length + shrunk.length
console.log(`예외 ${listed.length}개 · 뺄 것 ${failed}개${failed > 0 ? ' — `pnpm check:lines --update` 로 뺀다' : ''}`)
const readabilityFailed = await checkReadabilityBaseline({ update: false })
process.exit(failed + readabilityFailed > 0 ? 1 : 0)
