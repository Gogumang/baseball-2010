// **빠른 확인** (`yarn e2e:quick`) — 장면 표의 장면 **전부** × 기기에서 장면을 열고(smoke) 그 자리 · 연 상태 **전부**의 누름 칸을
// 훑는다(hits). `e2e:all` 의 smoke 와 hits 를 한 번 여는 데 합치고, 장면 × 기기를 맥락 여러 개로 함께 돌린다.
//
//   yarn e2e:quick                                  # e2e 빌드(약 5초) → preview → 장면 전부 × 기기 넷
//   yarn e2e:quick general-bat derby-start          # 장면만 골라
//   E2E_QUICK_DEVICES=chromium-desktop,webkit-iphone yarn e2e:quick    # 기기만 골라 (smoke 와 같은 둘)
//   E2E_QUICK_JOBS=chromium:8,webkit:6 yarn e2e:quick                  # 브라우저마다 함께 여는 맥락 수 (기본 24 · 20)
//   E2E_QUICK_URL=http://127.0.0.1:4910/ yarn e2e:quick                # 이미 띄운 서버(빌드 안 함 — 그 서버가 지금 코드인지는 내 몫)
//   E2E_QUICK_SKIP=general-defense yarn e2e:quick                      # 장면 빼기
//   E2E_QUICK_PORT=4910                                                # 제가 띄우는 preview 포트 (기본 4910)
//
// - 실제 시간으로 공을 여러 번 보내야 닿는 장면(돌발미션 결과 창 `nari-burst-result` · 미션 결과 판 `mission-result`)은 **경기 중간
//   스냅샷**(`e2e/snapshots/<장면>.json.gz`, `yarn e2e:snapshot`)으로 그 순간을 곧장 연다 — 시간을 빨리 감지 않는다. 실제 진행 길은
//   `e2e:all` 의 smoke 가 맡는다. 스냅샷이 낡았으면(부품 훅 차례가 바뀜) 그 장면만 실제 진행 길로 다시 열고 "낡은 스냅샷" 으로 알린다
//   — `yarn e2e:snapshot` 으로 다시 뜰 것.
// - 서버: 기본은 `vite build --mode e2e`(`e2e/.run/dist-quick`)를 새로 묶어 preview 로 띄우고 끝에 pid 로 끈다. 빌드 시간은 따로 찍는다.
// - 브라우저는 크로미움 · 웹킷 하나씩 띄우고, 일감(장면 × 기기)마다 새 맥락(빈 localStorage)을 연다.
// - 일감은 지난 실행에서 오래 걸린 차례로(`e2e/.run/quick-times.json`, 없으면 장면 표의 긴 장면 먼저) 꺼낸다 — 긴 장면이 끝에 남아
//   벽시계를 늘리지 않게.
// - 실패: 장면이 안 열림 · 쪽 오류(pageerror) · 허용 목록에 없는 누름 칸 겹침 · 연 상태 동작 실패. 하나라도 있으면 끝 코드 1.
// - 보고: `e2e/.run/quick-report.json`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cpus, freemem, totalmem } from 'node:os'

const ROOT = new URL('..', import.meta.url).pathname
const RUN = join(ROOT, 'e2e/.run')
const PORT = Number(process.env.E2E_QUICK_PORT ?? 4910)
const OWN_URL = `http://127.0.0.1:${PORT}/`
const URL_GIVEN = process.env.E2E_QUICK_URL
process.env.E2E_URL = URL_GIVEN ?? OWN_URL
mkdirSync(RUN, { recursive: true })

// E2E_URL 을 정한 뒤에 읽는다 — scene.mjs 가 읽을 때 주소를 굳힌다
const { chromium, webkit } = await import('playwright')
const { DEVICES } = await import('./lib/scene.mjs')
const { chromiumExecutable } = await import('./lib/browsers.mjs')
const { checkSceneHits } = await import('./lib/hits-scene.mjs')
const { startE2ePreview } = await import('./lib/preview.mjs')

/** 기기 꼴 — `e2e/hits.mjs` 와 같은 넷 */
const DEVICE_SETS = {
  'chromium-desktop': ['chromium', 'desktop', '가로'],
  'chromium-iphone': ['chromium', 'iphone', '세로'],
  'webkit-iphone': ['webkit', 'iphone', '세로'],
  'webkit-iphone-land': ['webkit', 'iphone-land', '가로'],
}
const deviceNames = (process.env.E2E_QUICK_DEVICES ?? Object.keys(DEVICE_SETS).join(',')).split(',').filter(Boolean)
for (const name of deviceNames) if (DEVICE_SETS[name] === undefined) throw new Error(`기기가 없다: ${name} (있는 것: ${Object.keys(DEVICE_SETS).join(', ')})`)
const JOBS = { chromium: 24, webkit: 20 }
for (const pair of (process.env.E2E_QUICK_JOBS ?? '').split(',').filter(Boolean)) {
  const [browserName, count] = pair.split(':')
  JOBS[browserName] = Number(count)
}

/** 장면 표의 이름들 — `export const SCENES` 아래 맨 앞 칸 열쇠 (smoke 와 같다) */
function sceneNames() {
  const source = readFileSync(join(ROOT, 'src/app/dev/scenes.ts'), 'utf8')
  const table = source.slice(source.indexOf('export const SCENES'))
  return [...table.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: \{/gm)].map((match) => match[1])
}

/** 첫 실행의 차례 — 공을 여러 번 보내야 닿는 장면(실제 시간) */
const FIRST_HINTS = { 'nari-ending': 15000, 'pitcher-ending': 15000 }
const TIMES_FILE = join(RUN, 'quick-times.json')
const hints = existsSync(TIMES_FILE) ? JSON.parse(readFileSync(TIMES_FILE, 'utf8')) : {}
const hintOf = (scene, device) => hints[`${scene}@${device}`] ?? FIRST_HINTS[scene] ?? 5000

/** e2e 빌드 → preview. 끄는 함수와 빌드 ms 를 돌려준다 */
const startServer = () => startE2ePreview({ port: PORT, dir: 'dist-quick' })

const asked = process.argv.slice(2)
const skipped = new Set((process.env.E2E_QUICK_SKIP ?? '').split(',').filter(Boolean))
const scenes = (asked.length > 0 ? asked : sceneNames()).filter((scene) => !skipped.has(scene))
const jobs = scenes.flatMap((scene) => deviceNames.map((device) => ({ scene, device })))
  .sort((a, b) => hintOf(b.scene, b.device) - hintOf(a.scene, a.device))

const started = Date.now()
const server = URL_GIVEN === undefined ? await startServer() : { stop: () => {}, buildMs: 0 }
const runStarted = Date.now()
const browsers = {}
/**
 * 메모리 — 브라우저 프로세스(Playwright 가 받은 크로미움 · 웹킷) RSS 합의 최고치와, 시스템의 쓸 수 있는 메모리
 * (macOS `vm_stat` 의 free + inactive + speculative, 아니면 `os.freemem`) 의 최저치. 다른 일이 브라우저를 띄우고 있으면 RSS 에 섞인다
 */
const memory = { peakBrowserRssMB: 0, minAvailableMB: Infinity }
const sampleMemory = () => {
  try {
    const rss = execFileSync('ps', ['-axo', 'rss=,command='], { encoding: 'utf8' }).split('\n')
      .filter((line) => /ms-playwright/.test(line)).reduce((sum, line) => sum + Number(line.trim().split(/\s+/)[0] || 0), 0)
    memory.peakBrowserRssMB = Math.max(memory.peakBrowserRssMB, Math.round(rss / 1024))
  } catch {}
  let available = freemem()
  try {
    const stat = execFileSync('vm_stat', { encoding: 'utf8' })
    const page = Number(/page size of (\d+)/.exec(stat)?.[1] ?? 4096)
    const pages = (name) => Number(new RegExp(`Pages ${name}:\\s+(\\d+)`).exec(stat)?.[1] ?? 0)
    available = (pages('free') + pages('inactive') + pages('speculative')) * page
  } catch {}
  memory.minAvailableMB = Math.min(memory.minAvailableMB, Math.round(available / 2 ** 20))
}
const memoryTimer = setInterval(sampleMemory, 1000)
const done = []
/** 스냅샷이 낡아 실제 진행 길로 연 장면 */
const staleSnapshots = new Set()
try {
  const needed = new Set(deviceNames.map((name) => DEVICE_SETS[name][0]))
  for (const browserName of needed) {
    const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
    browsers[browserName] = await (browserName === 'webkit' ? webkit : chromium).launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
  }
  /** 장면 하나를 새 맥락에서 — `query` 는 바로가기 주소에 더할 것 */
  const checkOnce = async (scene, device, query) => {
    const [browserName, deviceKind, orientation] = DEVICE_SETS[device]
    const context = await browsers[browserName].newContext(DEVICES[deviceKind])
    const page = await context.newPage()
    await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort())
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    let checked
    try {
      checked = await checkSceneHits(page, scene, { device, orientation, query })
    } catch (error) {
      checked = { results: [{ device, orientation, scene, state: '기본', checked: 0, underWindow: 0, dialogs: [], failures: [], allowed: [], error: String(error.message ?? error) }], reopened: 0 }
    } finally {
      await context.close().catch(() => {})
    }
    return { checked, pageErrors }
  }
  const runJob = async ({ scene, device }) => {
    const jobStarted = Date.now()
    let { checked, pageErrors } = await checkOnce(scene, device, '')
    // 낡은 스냅샷 — 그 장면만 실제 진행 길로 다시 (느리다)
    if (/스냅샷이 낡았다/.test(checked.results[0]?.error ?? '')) {
      staleSnapshots.add(scene)
      console.log(`낡은 스냅샷 ${scene} @${device} — 실제 진행 길로 다시 연다 (yarn e2e:snapshot ${scene} 으로 다시 뜰 것)`)
      ;({ checked, pageErrors } = await checkOnce(scene, device, 'real=1'))
    }
    const ms = Date.now() - jobStarted
    if (pageErrors.length > 0) checked.results[0].error ??= `pageerror: ${pageErrors[0].slice(0, 200)}`
    const bad = checked.results.filter((result) => result.error !== null || result.failures.length > 0)
    console.log(`${bad.length === 0 ? 'ok  ' : 'FAIL'} ${device.padEnd(18)} ${scene.padEnd(28)} 상태 ${checked.results.length} ${String(ms).padStart(6)}ms (열기 ${checked.openMs ?? '?'}ms)`)
    done.push({ scene, device, ms, openMs: checked.openMs ?? 0, results: checked.results, reopened: checked.reopened })
  }
  // 브라우저마다 따로 줄을 선다 — 맥락 수 한도가 브라우저마다라서
  await Promise.all(Object.keys(browsers).map((browserName) => {
    const queue = jobs.filter((job) => DEVICE_SETS[job.device][0] === browserName)
    return Promise.all(Array.from({ length: Math.max(1, Math.min(JOBS[browserName] ?? 4, queue.length)) }, async () => {
      for (let job = queue.shift(); job !== undefined; job = queue.shift()) await runJob(job)
    }))
  }))
} finally {
  clearInterval(memoryTimer)
  for (const browser of Object.values(browsers)) await browser.close().catch(() => {})
  server.stop()
}

const runMs = Date.now() - runStarted
const results = done.flatMap((job) => job.results)
const failures = results.filter((result) => result.error !== null || result.failures.length > 0)
for (const job of done) hints[`${job.scene}@${job.device}`] = job.ms
writeFileSync(TIMES_FILE, `${JSON.stringify(hints, null, 2)}\n`)
const slowest = [...done].sort((a, b) => b.ms - a.ms).slice(0, 8)
const report = {
  scenes: scenes.length,
  devices: deviceNames,
  jobs: done.length,
  states: results.length,
  allowed: results.reduce((sum, result) => sum + result.allowed.length, 0),
  buildMs: server.buildMs,
  runMs,
  totalMs: Date.now() - started,
  workMs: done.reduce((sum, job) => sum + job.ms, 0),
  openMs: done.reduce((sum, job) => sum + job.openMs, 0),
  concurrency: JOBS,
  memory: { totalGB: +(totalmem() / 2 ** 30).toFixed(1), ...memory, cpus: cpus().length },
  slowest: slowest.map((job) => ({ scene: job.scene, device: job.device, ms: job.ms })),
  failures: failures.map(({ device, scene, state, error, failures: rows }) => ({ device, scene, state, error, failures: rows })),
  staleSnapshots: [...staleSnapshots],
}
writeFileSync(join(RUN, 'quick-report.json'), `${JSON.stringify({ ...report, results }, null, 2)}\n`)

console.log(`\n장면 ${scenes.length} × 기기 ${deviceNames.length} = 일감 ${done.length} · 상태 ${results.length} · 허용된 겹침 ${report.allowed}건`)
console.log(`빌드 ${(server.buildMs / 1000).toFixed(1)}s · 돌리기 ${(runMs / 1000).toFixed(1)}s (일감 합 ${(report.workMs / 1000).toFixed(0)}s, 그중 장면 열기 ${(report.openMs / 1000).toFixed(0)}s · 맥락 ${JSON.stringify(JOBS)}) · 모두 ${(report.totalMs / 1000).toFixed(1)}s · 브라우저 RSS 최고 ${(memory.peakBrowserRssMB / 1024).toFixed(1)}GB · 쓸 수 있는 메모리 최저 ${(memory.minAvailableMB / 1024).toFixed(1)}GB`)
if (staleSnapshots.size > 0) console.log(`⚠️ 낡은 스냅샷 ${[...staleSnapshots].join(' · ')} — 실제 진행 길로 열었다. yarn e2e:snapshot 으로 다시 뜰 것`)
console.log(`오래 걸린 일감: ${slowest.map((job) => `${job.scene}@${job.device} ${(job.ms / 1000).toFixed(1)}s`).join(' · ')}`)
if (failures.length === 0) {
  console.log('통과')
  process.exit(0)
}
console.log(`\n실패 ${failures.length} 상태`)
for (const result of failures) {
  if (result.error !== null) console.log(`  ✗ [${result.device}] ${result.scene} · ${result.state}: ${result.error}`)
  for (const row of result.failures) {
    console.log(`  ✗ [${result.device}] ${result.scene} · ${result.state}: ${row.label} (z ${row.z}) ← ${row.by} (z ${row.byZ}${row.byDisabled ? ' · 꺼짐' : ''}) 점 ${row.points.join('·')}`)
  }
}
process.exit(1)
