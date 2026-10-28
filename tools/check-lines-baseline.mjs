#!/usr/bin/env node
// 150줄 예외 목록 검사 — `lint.max-lines-baseline.js` 의 파일이 아직 150줄(코드만)을 넘는지 본다.
//   pnpm check:lines           목록에서 빠져야 할 파일(150 이하 · 없는 파일)이 있으면 실패, 줄 수 주석이 틀리면 알림
//   pnpm check:lines --update  목록을 지금 줄 수로 다시 쓴다(150 이하 · 없는 파일은 빼고, 새 파일은 넣지 않는다)
// 줄 수는 oxlint max-lines 와 같은 셈(빈 줄 · 주석 빼고) — 그 규칙을 그대로 돌려 메시지에서 읽는다.
// 읽기 좋은 코드 규칙 예외 목록(`lint.readability-baseline.js`)도 같은 명령에서 본다 (`check-readability-baseline.mjs`).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { checkReadabilityBaseline } from './check-readability-baseline.mjs'
import { oxlintDiagnostics } from './lint/oxlintCounts.mjs'

const BASELINE = 'lint.max-lines-baseline.js'
const MAX = 150
const update = process.argv.includes('--update')

const listed = [...readFileSync(BASELINE, 'utf8').matchAll(/^\s*'([^']+)',\s*\/\/\s*(\d+)/gm)].map(([, file, lines]) => ({
  file,
  noted: Number(lines),
}))
const present = listed.filter(({ file }) => existsSync(file))
const missing = listed.filter(({ file }) => !existsSync(file))

// 0 을 넘으면 늘 보고되게 해서 정확한 줄 수를 받는다
const diagnostics = oxlintDiagnostics(
  { 'max-lines': ['error', { max: 0, skipBlankLines: true, skipComments: true }] },
  present.map(({ file }) => file),
)
const countOf = new Map(
  [...diagnostics].map(([file, list]) => {
    const message = list.find(({ rule }) => rule === 'max-lines')
    return [file, Number(message?.message.match(/\((\d+)\)/)?.[1] ?? 0)]
  }),
)
const rows = present.map((row) => ({ ...row, lines: countOf.get(row.file) ?? 0 }))
const shrunk = rows.filter(({ lines }) => lines <= MAX)
const drifted = rows.filter(({ lines, noted }) => lines > MAX && lines !== noted)

if (update) {
  const keep = rows.filter(({ lines }) => lines > MAX).sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file))
  const head = readFileSync(BASELINE, 'utf8').split('export const')[0]
  const body = keep.map(({ file, lines }) => `  '${file}', // ${lines}`).join('\n')
  writeFileSync(BASELINE, `${head}export const maxLinesBaseline = [\n${body}\n]\n`)
  console.log(`${BASELINE}: ${keep.length}개로 다시 썼다 (뺀 것 ${listed.length - keep.length})`)
  await checkReadabilityBaseline({ update: true })
  process.exit(0)
}

for (const { file } of missing) console.log(`없는 파일 — 목록에서 빼세요: ${file}`)
for (const { file, lines } of shrunk) console.log(`${MAX}줄 이하(${lines}) — 목록에서 빼세요: ${file}`)
for (const { file, lines, noted } of drifted) console.log(`줄 수 주석이 다르다(${noted} → ${lines}): ${file}`)
const failed = missing.length + shrunk.length
console.log(
  `예외 ${listed.length}개 · 뺄 것 ${failed}개 · 주석 다름 ${drifted.length}개${failed + drifted.length > 0 ? ' — `pnpm check:lines --update` 로 맞춘다' : ''}`,
)
const readabilityFailed = await checkReadabilityBaseline({ update: false })
process.exit(failed + readabilityFailed > 0 ? 1 : 0)
