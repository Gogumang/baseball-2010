// **누름 칸 맞음 검사** — 장면마다 누를 수 있는 요소(button · PressArea · [role=button] · 터치 상황 버튼)의 가운데 · 네 모서리 안쪽 점이
// 정말 그 요소에 닿는가(`elementFromPoint`). 창 · 상자를 연 상태(메뉴 '*' · 교체 '#' · 질문 상자 · 외출 말풍선)도 훑는다.
//
//   yarn e2e:hits                      # 장면 전부 × 기기 넷(chromium 가로 · chromium 세로 · webkit 아이폰 세로 · 가로)
//   yarn e2e:hits general-bat derby-start          # 장면만 골라
//   E2E_HITS_DEVICES=webkit-iphone yarn e2e:hits   # 기기만 골라 (쉼표)
//   E2E_HITS_JOBS=1 yarn e2e:hits                  # 기기를 몇 개씩 같이 돌릴지 (기본 4)
//
// 서버가 안 떠 있으면 `e2e/serve.sh` 로 띄우고 끝나면 끈다. 결과 JSON 은 `e2e/.run/hits-report.json`.
// 실패(허용 목록에 없는 겹침 · 장면/동작 실패)가 있으면 끝 코드 1.
//
// r195 · r203 · r207 · r212 — 화면에 보이는 단추 · 창 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹혔다.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch } from './lib/scene.mjs'
import { checkSceneHits } from './lib/hits-scene.mjs'
import { DEVICE_SETS } from './lib/devices.mjs'

const SCENE_NAMES = [
  'title',
  'main-menu',
  'nari-new',
  'pitcher-new',
  'season-new',
  'nari-management',
  'nari-outing',
  'pitcher-management',
  'season-management',
  'season-outing',
  'general-quick',
  'general-bat',
  'general-pitch',
  'general-defense',
  'derby-pick',
  'derby-start',
  'nari-burst-result',
  'pitcher-pitch',
  'pitcher-defense',
  'general-relay',
  'mission-bat',
  'mission-pitch',
  'mission-result',
  'season-postseason',
  'season-cup',
  'season-ending',
  'nari-postseason',
  'nari-cup',
  'nari-cup-result',
  'nari-ending',
  'nari-hall-of-fame',
  'pitcher-postseason',
  'pitcher-cup',
  'pitcher-cup-result',
  'pitcher-ending',
  'pitcher-hall-of-fame',
  'nari-postseason-game',
  'nari-postseason-next',
  'nari-postseason-champion',
  'nari-korean-series',
  'nari-cup-win',
  'pitcher-postseason-game',
  'pitcher-postseason-next',
  'pitcher-postseason-champion',
  'pitcher-korean-series',
  'pitcher-cup-win',
]

const argScenes = process.argv.slice(2)
const scenes = argScenes.length > 0 ? argScenes : SCENE_NAMES
const deviceNames = (process.env.E2E_HITS_DEVICES ?? Object.keys(DEVICE_SETS).join(',')).split(',').filter(Boolean)
const jobs = Number(process.env.E2E_HITS_JOBS ?? 4)

/** 서버 — 떠 있으면 그대로, 아니면 띄우고 끝에 끈다 */
function ensureServer() {
  try {
    execFileSync('e2e/serve.sh', ['status'], { stdio: 'ignore' })
    return false
  } catch {
    execFileSync('e2e/serve.sh', [], { stdio: 'inherit' })
    return true
  }
}

async function runDevice(deviceName) {
  const [browserName, device, orientation] = DEVICE_SETS[deviceName] ?? []
  if (browserName === undefined) throw new Error(`기기가 없다: ${deviceName} (있는 것: ${Object.keys(DEVICE_SETS).join(', ')})`)
  const started = Date.now()
  const session = await launch(browserName, { device })
  const results = []
  let reopened = 0
  try {
    for (const scene of scenes) {
      const sceneStarted = Date.now()
      const checked = await checkSceneHits(session.page, scene, { device: deviceName, orientation, verbose: Boolean(process.env.E2E_HITS_VERBOSE) })
      results.push(...checked.results)
      reopened += checked.reopened
      console.log(`  ${deviceName} ${scene} ${Date.now() - sceneStarted}ms`)
    }
  } finally {
    await session.browser.close()
  }
  return { deviceName, results, reopened, ms: Date.now() - started, errors: session.errors }
}

async function main() {
  const started = Date.now()
  mkdirSync('e2e/.run', { recursive: true })
  const startedServer = ensureServer()
  const runs = []
  try {
    const queue = [...deviceNames]
    const workers = Array.from({ length: Math.max(1, Math.min(jobs, queue.length)) }, async () => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) runs.push(await runDevice(name))
    })
    await Promise.all(workers)
  } finally {
    if (startedServer) execFileSync('e2e/serve.sh', ['stop'], { stdio: 'inherit' })
  }

  const results = runs.flatMap((run) => run.results)
  const failures = results.filter((result) => result.failures.length > 0 || result.error !== null)
  const allowed = results.flatMap((result) =>
    result.allowed.map((row) => ({ ...row, device: result.device, scene: result.scene, state: result.state })),
  )
  writeFileSync('e2e/.run/hits-report.json', `${JSON.stringify({ results, ms: Date.now() - started }, null, 2)}\n`)

  console.log('\n기기별')
  for (const run of runs) {
    const own = run.results
    console.log(
      `  ${run.deviceName}: 상태 ${own.length} · 요소 ${own.reduce((sum, r) => sum + r.checked, 0)} · 창 아래 ${own.reduce((sum, r) => sum + r.underWindow, 0)} · 다시 연 장면 ${run.reopened} · ${(run.ms / 1000).toFixed(1)}s`,
    )
  }
  const allowedByWhy = new Map()
  for (const row of allowed) {
    const entry = allowedByWhy.get(row.why) ?? { count: 0, pairs: new Set() }
    entry.count++
    entry.pairs.add(`${row.scene}: ${row.label.replace(/^button /, '')} ← ${row.by.replace(/^button /, '')}`)
    allowedByWhy.set(row.why, entry)
  }
  console.log(`\n허용된 겹침 ${allowed.length}건`)
  for (const [why, { count, pairs }] of allowedByWhy) console.log(`  ${count}× ${why}\n     ${[...pairs].join(' · ')}`)
  if (failures.length === 0) {
    console.log(`\n겹침 없음 — ${results.length} 상태 · ${((Date.now() - started) / 1000).toFixed(1)}s`)
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
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`)
  return 1
}

process.exit(await main())
