// 예외 목록 검사(`tools/check-lines-baseline.mjs` · `tools/check-readability-baseline.mjs`)가 쓰는 oxlint 실행 도우미.
// 저장소 설정(`oxlint.config.ts`) 대신 고른 규칙만 켠 임시 설정으로 파일들을 돌려 진단을 파일별로 모은다.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const OXLINT = join(ROOT, 'node_modules/.bin/oxlint')

/** `eslint(max-lines)` → `max-lines` */
const ruleOf = (code) => code?.match(/^[\w-]+\((.+)\)$/)?.[1] ?? code

/**
 * 고른 규칙(`rules`)만으로 `files` 를 돌려 `Map<파일, 진단[]>` 를 낸다. 진단에는 `rule` 이 붙는다.
 * eslint 밖의 규칙은 `plugins`(oxlint 내장 — `import` …) · `jsPlugins`(저장소 뿌리 기준 경로)로 싣는다.
 */
export function oxlintDiagnostics(rules, files, { plugins = ['eslint'], jsPlugins = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-counts-'))
  const config = join(dir, 'oxlintrc.json')
  const absoluteJsPlugins = jsPlugins.map((plugin) => join(ROOT, plugin))
  writeFileSync(config, JSON.stringify({ categories: { correctness: 'off' }, plugins, jsPlugins: absoluteJsPlugins, rules }))
  const run = spawnSync(OXLINT, ['-c', config, '--disable-nested-config', '-f', 'json', ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 2 ** 20,
  })
  rmSync(dir, { recursive: true, force: true })
  if (run.error) throw run.error
  if (run.stdout.trim() === '') throw new Error(`oxlint 출력 없음 (끝 코드 ${run.status}): ${run.stderr}`)
  const byFile = new Map()
  for (const diagnostic of JSON.parse(run.stdout).diagnostics) {
    const list = byFile.get(diagnostic.filename) ?? []
    list.push({ ...diagnostic, rule: ruleOf(diagnostic.code) })
    byFile.set(diagnostic.filename, list)
  }
  return byFile
}
