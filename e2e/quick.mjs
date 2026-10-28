// **빠른 확인** (`yarn e2e:quick`) — 장면 표의 장면 **전부** × 기기 넷에서 장면을 열고(smoke) 그 자리 · 연 상태 **전부**의 누름 칸을
// 훑는다(hits). 머지 전 전체 확인용이다 — 상황 하나 · 도메인 하나만 볼 때는 `yarn e2e:only`(크로미움 하나 · 맥락 2).
//
//   yarn e2e:quick                                  # e2e 빌드(낡았을 때만) → preview → 장면 전부 × 기기 넷, 맥락 크로미움 2 · 웹킷 2
//   yarn e2e:quick general-bat derby-start          # 장면만 골라
//   E2E_QUICK_DEVICES=chromium-desktop,webkit-iphone yarn e2e:quick    # 기기만 골라
//   E2E_QUICK_JOBS=chromium:2,webkit:2 yarn e2e:quick                  # 브라우저마다 함께 여는 맥락 수 (기본 2 · 2 — 기계를 나눠 쓴다)
//   E2E_QUICK_URL=http://127.0.0.1:4910/ yarn e2e:quick                # 이미 띄운 서버(빌드 안 함 — 그 서버가 지금 코드인지는 내 몫)
//   E2E_QUICK_SKIP=general-defense yarn e2e:quick                      # 장면 빼기
//   E2E_QUICK_PORT=4910                                                # 제가 띄우는 preview 포트 (기본 4910)
//   E2E_REBUILD=1 yarn e2e:quick                                       # 산출물이 새것이어도 다시 묶기
//
// - 맥락 수: r328 은 크로미움 24 · 웹킷 20 으로 60초에 맞췄으나 14코어 · 약 11GB 를 다 써 CPU 99% 사고가 났다(r342). 시간보다 자원.
// - 경기 중간 스냅샷(`e2e/snapshots/<장면>.json.gz`, `yarn e2e:snapshot`)이 있는 장면은 그 순간을 곧장 연다. 낡았으면(부품 훅 차례가
//   바뀜) 그 장면만 실제 진행 길로 다시 열고 "낡은 스냅샷" 으로 알린다. 실제 진행 길은 `e2e:all` 의 smoke 가 맡는다.
// - 서버: `vite build --mode e2e`(`e2e/.run/dist-quick`, 입력보다 새것이면 다시 씀)를 preview 로 띄우고 끝에 끈다.
// - 일감은 지난 실행에서 오래 걸린 차례로(`e2e/.run/quick-times.json`) 꺼낸다.
// - 실패: 장면이 안 열림 · 쪽 오류(pageerror) · 허용 목록에 없는 누름 칸 겹침 · 연 상태 동작 실패. 하나라도 있으면 끝 코드 1.
// - 끝에 자원(CPU 초 합 · 최대 RSS · 동시 브라우저 · 맥락)을 찍는다. 보고: `e2e/.run/quick-report.json`.
const PORT = Number(process.env.E2E_QUICK_PORT ?? 4910)
const URL_GIVEN = process.env.E2E_QUICK_URL
process.env.E2E_URL = URL_GIVEN ?? `http://127.0.0.1:${PORT}/`

// E2E_URL 을 정한 뒤에 읽는다 — scene.mjs 가 읽을 때 주소를 굳힌다
const { sceneCatalog } = await import('./lib/catalog.mjs')
const { DEVICE_SETS, deviceList } = await import('./lib/devices.mjs')
const { startE2ePreview } = await import('./lib/preview.mjs')
const { runScenes } = await import('./lib/run-scenes.mjs')
const { finishRun, loadHints } = await import('./lib/run-report.mjs')
const { startUsageMeter } = await import('./lib/usage.mjs')

const devices = deviceList(process.env.E2E_QUICK_DEVICES ?? Object.keys(DEVICE_SETS).join(','))
const concurrency = { chromium: 2, webkit: 2 }
for (const pair of (process.env.E2E_QUICK_JOBS ?? '').split(',').filter(Boolean)) {
  const [browserName, count] = pair.split(':')
  concurrency[browserName] = Number(count)
}
const { hints, hintOf } = loadHints()
const asked = process.argv.slice(2)
const skipped = new Set((process.env.E2E_QUICK_SKIP ?? '').split(',').filter(Boolean))
const scenes = (asked.length > 0 ? asked : sceneCatalog().map((scene) => scene.name)).filter((scene) => !skipped.has(scene))
const jobs = scenes
  .flatMap((scene) => devices.map((device) => ({ scene, device })))
  .sort((a, b) => hintOf(b.scene, b.device) - hintOf(a.scene, a.device))

const started = Date.now()
const meter = startUsageMeter()
const server = URL_GIVEN === undefined ? await startE2ePreview({ port: PORT, dir: 'dist-quick' }) : { stop: () => {}, buildMs: 0, reused: true }
const runStarted = Date.now()
let run
try {
  run = await runScenes({ jobs, concurrency, verbose: Boolean(process.env.E2E_HITS_VERBOSE) })
} finally {
  server.stop()
}
const usage = await meter.stop()
process.exit(finishRun({ reportName: 'quick-report.json', scenes, devices, concurrency, run, server, usage, started, runStarted, hints }))
