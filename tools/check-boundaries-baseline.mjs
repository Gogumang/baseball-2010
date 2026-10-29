#!/usr/bin/env node
// FSD 층 경계 · 순환 import 검사 (r366) — `lint.boundaries-baseline.js` 의 세 규칙을 src 전체(시험 파일 빼고)에 돌린다.
//   pnpm check:boundaries           새 위반(목록에 없는 파일)이나 목록에서 빠져야 할 파일(위반 0 · 없는 파일)이 있으면 실패
//   pnpm check:boundaries --update  빠져야 할 파일을 목록에서 빼고 이름만 알파벳 순으로 다시 쓴다(새 위반은 넣지 않는다)
// 같은 규칙은 `pnpm lint`(oxlint.config.ts)에도 켜져 있다 — 이 검사는 예외 목록이 줄어들기만 하는지를 본다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { relative } from 'node:path'
import { boundaryRules } from '../lint.boundaries-baseline.js'
import { oxlintDiagnostics } from './lint/oxlintCounts.mjs'

const BASELINE = 'lint.boundaries-baseline.js'
const ROOT = new URL('..', import.meta.url).pathname
const TEST_FILE = /\.test\.tsx?$/
/** 진단의 규칙 이름 → 예외 목록 이름 */
const LISTS = { 'fsd-layer-direction': 'layerDirectionBaseline', 'fsd-cross-slice': 'crossSliceBaseline', 'no-cycle': 'cycleBaseline' }
const update = process.argv.includes('--update')

// 줄마다 하나씩 쓴 목록과 oxfmt 가 한 줄로 접은 짧은 목록(`['a', 'b']`)을 둘 다 읽는다
const listPattern = (name) => new RegExp(`(export const ${name} = \\[\\n?)([^\\]]*)(\\])`)

/** 예외 목록 하나의 파일 이름들 */
function readList(source, name) {
  const body = source.match(listPattern(name))?.[2] ?? ''
  return [...body.matchAll(/'([^']+)'/g)].map(([, file]) => file)
}

/** 예외 목록 하나를 이름만(알파벳 순)으로 다시 쓴 원문 */
function withList(source, name, files) {
  const body = [...files]
    .sort()
    .map((file) => `  '${file}',\n`)
    .join('')
  return source.replace(listPattern(name), (_, _head, _body, tail) => `export const ${name} = [\n${body}${tail}`)
}

/** 규칙 이름 → 그 규칙을 어기는 파일(저장소 뿌리 기준 경로) */
function violatorsByRule() {
  const diagnostics = oxlintDiagnostics(boundaryRules, ['src'], { plugins: ['eslint', 'import'], jsPlugins: ['tools/lint/localPlugin.mjs'] })
  const byRule = new Map(Object.keys(LISTS).map((rule) => [rule, new Set()]))
  for (const [filename, list] of diagnostics) {
    const file = relative(ROOT, filename)
    if (TEST_FILE.test(file)) continue
    for (const { rule } of list) byRule.get(rule)?.add(file)
  }
  return byRule
}

let source = readFileSync(BASELINE, 'utf8')
let failed = 0
for (const [rule, violators] of violatorsByRule()) {
  const name = LISTS[rule]
  const listed = readList(source, name)
  const listedSet = new Set(listed)
  const stale = listed.filter((file) => !existsSync(file) || !violators.has(file))
  const added = [...violators].filter((file) => !listedSet.has(file))
  if (update) {
    source = withList(
      source,
      name,
      listed.filter((file) => !stale.includes(file)),
    )
    console.log(`${name}: ${listed.length - stale.length}개로 다시 썼다 (뺀 것 ${stale.length})`)
    continue
  }
  for (const file of added) console.log(`새 위반(${rule}) — 고치세요: ${file}`)
  for (const file of stale) console.log(`위반 0 · 없는 파일 — 목록에서 빼세요(${name}): ${file}`)
  console.log(`${name}: 예외 ${listed.length}개 · 새 위반 ${added.length}개 · 뺄 것 ${stale.length}개`)
  failed += added.length + stale.length
}
if (update) writeFileSync(BASELINE, source)
if (failed > 0 && !update) console.log('뺄 것은 `pnpm check:boundaries --update` 로 뺀다. 새 위반은 목록에 넣지 말고 고친다')
process.exit(failed > 0 && !update ? 1 : 0)
