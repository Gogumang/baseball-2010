// **골라 시험하기** (`pnpm e2e:only`) — 장면 하나 · 상태 하나 · 도메인 하나 · 바뀐 파일과 관련된 장면만 열어 누름 칸을 훑는다.
// 기본은 가볍게: 크로미움 데스크톱 하나, 맥락 2. 웹킷 · 기기 넷은 옵션으로만. 끝에 CPU 초 합 · 최대 RSS · 동시 브라우저 수를 찍는다.
//
//   pnpm e2e:only nari-outing                         # 장면 하나 (기본 상태 + 연 상태 전부)
//   pnpm e2e:only nari-outing --state "번화가 말풍선"   # 상태 하나 (이름 일부여도 된다 · 여러 번 줄 수 있다 · 기본 상태는 '기본')
//   pnpm e2e:only 'general-*'                         # 이름 무늬
//   pnpm e2e:only --area nari                         # 도메인 하나 (쉼표로 여럿) — 도메인 = src/app/dev/scenes/<도메인>.ts
//   pnpm e2e:only --changed                           # main 과 갈라진 뒤 바뀐 파일(+ 커밋 안 한 것)과 관련된 장면만 (--changed=<기준>)
//   pnpm e2e:only --list                              # 도메인 · 장면 · 상태 목록만 찍고 끝 (--dry: 고른 장면만 찍고 끝)
//   --webkit (웹킷 아이폰 더하기) · --all-devices (기기 넷) · --device <이름,…> · --jobs <맥락 수, 기본 2> · --real (스냅샷 대신 실제 진행)
//   --url <이미 띄운 서버> · E2E_ONLY_PORT (제가 띄우는 preview 포트, 기본 4930) · E2E_REBUILD=1 (산출물이 새것이어도 다시 묶기)
const argv = process.argv.slice(2)
const flags = { states: [], areas: [], devices: null, jobs: 2, changed: null, list: false, real: false, url: undefined, names: [] }
for (let index = 0; index < argv.length; index++) {
  const arg = argv[index]
  const value = () => argv[++index] ?? ''
  if (arg === '--state') flags.states.push(value())
  else if (arg === '--area') flags.areas.push(...value().split(',').filter(Boolean))
  else if (arg === '--device') flags.devices = value()
  else if (arg === '--webkit') flags.devices = 'chromium-desktop,webkit-iphone'
  else if (arg === '--all-devices') flags.devices = 'chromium-desktop,chromium-iphone,webkit-iphone,webkit-iphone-land'
  else if (arg === '--jobs') flags.jobs = Number(value())
  else if (arg === '--changed' || arg.startsWith('--changed=')) flags.changed = arg.split('=')[1] ?? true
  else if (arg === '--list') flags.list = true
  else if (arg === '--dry') flags.dry = true
  else if (arg === '--real') flags.real = true
  else if (arg === '--url') flags.url = value()
  else if (arg.startsWith('--')) throw new Error(`모르는 옵션: ${arg}`)
  else flags.names.push(arg)
}
const PORT = Number(process.env.E2E_ONLY_PORT ?? 4930)
process.env.E2E_URL = flags.url ?? `http://127.0.0.1:${PORT}/`

const { ACTIONS, AREAS, sceneCatalog } = await import('./lib/catalog.mjs')
const catalog = sceneCatalog()
const areaNames = [...new Set(catalog.map((scene) => scene.area))]

if (flags.list) {
  for (const area of areaNames) {
    console.log(`\n${area}  (pnpm e2e:only --area ${area})`)
    for (const scene of catalog.filter((row) => row.area === area)) {
      console.log(`  ${scene.name}${scene.snapshot === null ? '' : '  [스냅샷]'}`)
      for (const action of ACTIONS[scene.name] ?? []) console.log(`      --state "${action.name}"`)
    }
  }
  process.exit(0)
}

/** 장면 고르기 — 이름 · 무늬 · 도메인 · 바뀐 파일 */
const picked = new Set()
const pattern = (text) => new RegExp(`^${text.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
for (const name of flags.names) {
  const hits = catalog.filter((scene) => pattern(name).test(scene.name))
  if (hits.length === 0) throw new Error(`장면이 없다: ${name} (pnpm e2e:only --list)`)
  for (const scene of hits) picked.add(scene.name)
}
for (const area of flags.areas) {
  if (!areaNames.includes(area)) throw new Error(`도메인이 없다: ${area} (있는 것: ${areaNames.join(', ')})`)
  for (const scene of catalog.filter((row) => row.area === area)) picked.add(scene.name)
}
if (flags.changed !== null) {
  const { areasOfChanges, changedFiles } = await import('./lib/changed.mjs')
  const { byFile, areas, broad } = areasOfChanges(changedFiles(flags.changed === true ? undefined : flags.changed))
  console.log(`바뀐 파일 ${byFile.length} → 도메인 ${areas.join(' · ') || '없음'}`)
  for (const [file, list] of byFile) if (list.length > 0) console.log(`  ${file} → ${list.join(' · ')}`)
  for (const scene of catalog.filter((row) => areas.includes(row.area))) picked.add(scene.name)
  if (broad.length > 0) {
    console.log(
      `도메인 없는 바탕 파일 ${broad.length}개(${broad.slice(0, 3).join(' · ')}${broad.length > 3 ? ' …' : ''}) — 도메인마다 대표 장면 하나씩 더 본다`,
    )
    for (const area of Object.values(AREAS)) if (area.representative !== null) picked.add(area.representative)
  }
}
if (picked.size === 0) {
  console.log(
    flags.changed !== null
      ? '관련 장면 없음 — 볼 것이 없다'
      : '쓰는 법: pnpm e2e:only <장면|무늬…> [--state <이름>] [--area <도메인>] [--changed] [--list]',
  )
  process.exit(flags.changed !== null ? 0 : 2)
}
const scenes = catalog.map((scene) => scene.name).filter((name) => picked.has(name))

/** 상태 고르기 — '기본' 은 기본 상태, 나머지는 연 상태 이름(일부여도) */
let states
if (flags.states.length > 0) {
  const matches = (name) => flags.states.some((wanted) => name === wanted || (wanted !== '기본' && name.includes(wanted)))
  states = matches
  const any = scenes.some((scene) => matches('기본') || (ACTIONS[scene] ?? []).some((action) => matches(action.name)))
  if (!any) throw new Error(`고른 장면에 그 상태가 없다: ${flags.states.join(' · ')} (pnpm e2e:only --list)`)
}

if (flags.dry) {
  console.log(`고른 장면 ${scenes.length}: ${scenes.join(' · ')}`)
  process.exit(0)
}

const { DEVICE_SETS, deviceList } = await import('./lib/devices.mjs')
const { startE2ePreview } = await import('./lib/preview.mjs')
const { runScenes } = await import('./lib/run-scenes.mjs')
const { finishRun, loadHints } = await import('./lib/run-report.mjs')
const { startUsageMeter } = await import('./lib/usage.mjs')

const devices = deviceList(flags.devices ?? 'chromium-desktop')
const concurrency = Object.fromEntries([...new Set(devices.map((device) => DEVICE_SETS[device][0]))].map((browser) => [browser, flags.jobs]))
if (flags.jobs * Object.keys(concurrency).length > 4) console.log(`⚠️ 맥락 ${flags.jobs} × 브라우저 — 기계를 나눠 쓴다면 모두 4 이하로`)
const { hints, hintOf } = loadHints()
const jobs = scenes
  .flatMap((scene) => devices.map((device) => ({ scene, device })))
  .sort((a, b) => hintOf(b.scene, b.device) - hintOf(a.scene, a.device))
console.log(
  `장면 ${scenes.length}: ${scenes.join(' · ')}${flags.states.length > 0 ? ` · 상태 ${flags.states.join(' · ')}` : ''} · 기기 ${devices.join(' · ')} · 맥락 ${flags.jobs}`,
)

const started = Date.now()
const meter = startUsageMeter()
const server = flags.url === undefined ? await startE2ePreview({ port: PORT, dir: 'dist-quick' }) : { stop: () => {}, buildMs: 0, reused: true }
const runStarted = Date.now()
let run
try {
  run = await runScenes({ jobs, concurrency, states, real: flags.real })
} finally {
  server.stop()
}
const usage = await meter.stop()
process.exit(finishRun({ reportName: 'only-report.json', scenes, devices, concurrency, run, server, usage, started, runStarted, hints }))
