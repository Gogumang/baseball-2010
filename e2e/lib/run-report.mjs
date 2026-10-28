// 장면 일감 결과 — 걸린 시간 기록(다음 차례 정하기) · 요약 줄 · 실패 줄 · 보고 JSON. `e2e/quick.mjs` · `e2e/only.mjs` 가 같이 쓴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatUsage } from './usage.mjs'

const RUN = join(new URL('../..', import.meta.url).pathname, 'e2e/.run')
const TIMES_FILE = join(RUN, 'quick-times.json')
mkdirSync(RUN, { recursive: true })

/** 첫 실행의 차례 — 공을 여러 번 보내야 닿는 장면(실제 시간) */
const FIRST_HINTS = { 'nari-ending': 15000, 'pitcher-ending': 15000 }

/** 지난 실행에서 걸린 ms (`장면@기기`) — 긴 일감을 먼저 꺼내 끝에 남지 않게 */
export function loadHints() {
  const hints = existsSync(TIMES_FILE) ? JSON.parse(readFileSync(TIMES_FILE, 'utf8')) : {}
  return { hints, hintOf: (scene, device) => hints[`${scene}@${device}`] ?? FIRST_HINTS[scene] ?? 5000 }
}

/**
 * 요약을 찍고 `e2e/.run/<reportName>` 에 적는다 — 끝 코드(실패가 있으면 1)를 돌려준다.
 * `run`: `runScenes` 결과, `server`: `{ buildMs, reused }`, `usage`: `usage.mjs` 결과
 */
export function finishRun({ reportName, scenes, devices, concurrency, run, server, usage, started, runStarted, hints }) {
  const { done, staleSnapshots, peakContexts } = run
  const runMs = Date.now() - runStarted
  const results = done.flatMap((job) => job.results)
  const failures = results.filter((result) => result.error !== null || result.failures.length > 0)
  for (const job of done) hints[`${job.scene}@${job.device}`] = job.ms
  writeFileSync(TIMES_FILE, `${JSON.stringify(hints, null, 2)}\n`)
  const slowest = [...done].sort((a, b) => b.ms - a.ms).slice(0, 8)
  const report = {
    scenes: scenes.length,
    devices,
    jobs: done.length,
    states: results.length,
    allowed: results.reduce((sum, result) => sum + result.allowed.length, 0),
    buildMs: server.buildMs,
    buildReused: server.reused ?? false,
    runMs,
    totalMs: Date.now() - started,
    workMs: done.reduce((sum, job) => sum + job.ms, 0),
    openMs: done.reduce((sum, job) => sum + job.openMs, 0),
    concurrency,
    usage: { ...usage, peakContexts },
    slowest: slowest.map((job) => ({ scene: job.scene, device: job.device, ms: job.ms, openMs: job.openMs })),
    failures: failures.map(({ device, scene, state, error, failures: rows }) => ({ device, scene, state, error, failures: rows })),
    staleSnapshots,
  }
  writeFileSync(join(RUN, reportName), `${JSON.stringify({ ...report, results }, null, 2)}\n`)

  console.log(`\n장면 ${scenes.length} × 기기 ${devices.length} = 일감 ${done.length} · 상태 ${results.length} · 허용된 겹침 ${report.allowed}건`)
  const build = server.reused ? '빌드 다시 씀' : `빌드 ${(server.buildMs / 1000).toFixed(1)}s`
  console.log(
    `${build} · 돌리기 ${(runMs / 1000).toFixed(1)}s (일감 합 ${(report.workMs / 1000).toFixed(0)}s, 그중 장면 열기 ${(report.openMs / 1000).toFixed(0)}s · 맥락 ${JSON.stringify(concurrency)}) · 모두 ${(report.totalMs / 1000).toFixed(1)}s`,
  )
  console.log(formatUsage(usage, { peakContexts }))
  if (staleSnapshots.length > 0)
    console.log(`⚠️ 낡은 스냅샷 ${staleSnapshots.join(' · ')} — 실제 진행 길로 열었다. pnpm e2e:snapshot 으로 다시 뜰 것`)
  if (done.length > 1) console.log(`오래 걸린 일감: ${slowest.map((job) => `${job.scene}@${job.device} ${(job.ms / 1000).toFixed(1)}s`).join(' · ')}`)
  if (failures.length === 0) {
    console.log('통과')
    return 0
  }
  console.log(`\n실패 ${failures.length} 상태`)
  for (const result of failures) {
    if (result.error !== null) console.log(`  ✗ [${result.device}] ${result.scene} · ${result.state}: ${result.error}`)
    for (const row of result.failures) {
      console.log(
        `  ✗ [${result.device}] ${result.scene} · ${result.state}: ${row.label} (z ${row.z}) ← ${row.by} (z ${row.byZ}${row.byDisabled ? ' · 꺼짐' : ''}) 점 ${row.points.join('·')}`,
      )
    }
  }
  return 1
}
