#!/usr/bin/env node
// 읽기 좋은 코드 규칙 예외 목록 검사 — `eslint.readability-baseline.js` 의 파일이 아직 규칙(complexity · max-depth …)을 어기는지 본다.
//   pnpm check:lines           목록에서 빠져야 할 파일(위반 0 · 없는 파일)이 있으면 실패, 위반 수 주석이 틀리면 알림
//   pnpm check:lines --update  목록을 지금 위반 수로 다시 쓴다(0 · 없는 파일은 빼고, 새 파일은 넣지 않는다)
// 혼자 돌려도 된다: `node tools/check-readability-baseline.mjs [--update]`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import { readabilityRules } from '../eslint.readability-baseline.js'

const BASELINE = 'eslint.readability-baseline.js'
const RULES = new Set(Object.keys(readabilityRules))

/** 파일마다 다섯 규칙 위반 수 — 0 인 파일은 빠진다 */
export async function readabilityCounts(patterns) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
        rules: readabilityRules,
      },
    ],
  })
  const results = await eslint.lintFiles(patterns)
  const counts = new Map()
  for (const result of results) {
    const count = result.messages.filter((message) => RULES.has(message.ruleId)).length
    if (count > 0) counts.set(result.filePath.slice(process.cwd().length + 1), count)
  }
  return counts
}

/** 목록 검사(또는 `update` 면 다시 쓰기). 실패한 줄 수를 낸다 */
export async function checkReadabilityBaseline({ update }) {
  const listed = [...readFileSync(BASELINE, 'utf8').matchAll(/^\s*'([^']+)',\s*\/\/\s*(\d+)/gm)].map(([, file, count]) => ({
    file,
    noted: Number(count),
  }))
  const present = listed.filter(({ file }) => existsSync(file))
  const missing = listed.filter(({ file }) => !existsSync(file))
  const countOf = present.length === 0 ? new Map() : await readabilityCounts(present.map(({ file }) => file))
  const rows = present.map((row) => ({ ...row, count: countOf.get(row.file) ?? 0 }))
  const clean = rows.filter(({ count }) => count === 0)
  const drifted = rows.filter(({ count, noted }) => count > 0 && count !== noted)

  if (update) {
    const keep = rows.filter(({ count }) => count > 0).sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
    writeBaseline(keep)
    console.log(`${BASELINE}: ${keep.length}개로 다시 썼다 (뺀 것 ${listed.length - keep.length})`)
    return 0
  }
  for (const { file } of missing) console.log(`없는 파일 — 목록에서 빼세요: ${file}`)
  for (const { file } of clean) console.log(`읽기 규칙 위반 0 — 목록에서 빼세요: ${file}`)
  for (const { file, count, noted } of drifted) console.log(`위반 수 주석이 다르다(${noted} → ${count}): ${file}`)
  const failed = missing.length + clean.length
  console.log(
    `읽기 규칙 예외 ${listed.length}개 · 뺄 것 ${failed}개 · 주석 다름 ${drifted.length}개${failed + drifted.length > 0 ? ' — `pnpm check:lines --update` 로 맞춘다' : ''}`,
  )
  return failed
}

/** 목록 부분만 다시 쓴다(머리 주석 · 규칙은 그대로) */
export function writeBaseline(rows) {
  const text = readFileSync(BASELINE, 'utf8')
  const head = text.split('export const readabilityBaseline')[0]
  const body = rows.map(({ file, count }) => `  '${file}', // ${count}`).join('\n')
  writeFileSync(BASELINE, `${head}export const readabilityBaseline = [\n${body}\n]\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit((await checkReadabilityBaseline({ update: process.argv.includes('--update') })) > 0 ? 1 : 0)
}
