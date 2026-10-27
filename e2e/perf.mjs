// 첫 진입 성능 재기 — 느린 4G 를 흉내 내어 배포 꼴 빌드의 첫 화면 · 메인 메뉴 · 나리 관리 · 첫 타석까지 잰다.
//
//   E2E_PORT=5440 e2e/serve.sh e2e          # `vite build --mode e2e` + preview (압축 켜짐, 바로가기 켜짐)
//   (vite preview --outDir dist --port 5441)  # 배포 빌드 — 켤 때 길용
//   E2E_PORT=5440 PERF_BOOT_URL=http://127.0.0.1:5441/ yarn node e2e/perf.mjs    # chromium(데스크톱) · webkit(아이폰 13) 각 PERF_RUNS 번(기본 2) — 가운데 값
//   PERF_RUNS=3 PERF_ONLY=webkit yarn node e2e/perf.mjs
//   PERF_REVISIT=nari-management PERF_ONLY=chromium PERF_NET=rtt …   # 다시 방문 — 같은 맥락(같은 HTTP 캐시)에서 장면을 두 번 열고 두 번째를 잰다
//                                                                       (r318 — `e2e/serve-vercel.mjs` 로 `vercel.json` 머리를 붙여 띄운 서버에)
//
// 느린 4G (Lighthouse 모바일 기준): 왕복 150ms · 내려받기 1.6Mbps · 올리기 750kbps.
//  - chromium: CDP `Network.emulateNetworkConditions` (받은 바이트 = `encodedDataLength`)
//  - webkit: CDP 가 없어 라우트로 늦춘다 — 요청마다 왕복 150ms 뒤 한 줄(1.6Mbps)을 나눠 쓰며 보낸다. 글(js · css · json · html)은
//    gzip 크기로 센다(preview 가 gzip 으로 보내는 것과 맞춘다). **라우트가 걸리면 HTTP 캐시가 꺼진다** — 같은 주소를 다시 받은 것까지
//    요청으로 센다(표에 "캐시 꺼짐"으로 적는다).
//
// 크로미움은 `page.route` 를 쓰지 않는다(r311, OPTIMIZATION-2026-10-27 A8). 라우트가 하나라도 걸리면 HTTP 캐시가 꺼져
// 같은 그림을 여러 번 다시 받고 요청 수가 부푼다(general-defense 1,861 ↔ 실제 1,342). 웹폰트 CDN 은 실행 인자
// `--host-resolver-rules` 로 닫힌 포트에 묶어 끊는다. 요청 수는 CDP 로 센 망 요청이고 디스크 · 메모리 캐시에서 온 것은 빼고 센다.
//
// 잰 것 (쪽 이동 시작부터 ms):
//  - 이용안내: 글줄(`data-part="글줄"`)이 서고 웹폰트까지 온 때 — 바로가기 없이 켤 때 길 그대로
//  - 메뉴: 이용안내 → 아무 키 → 로고(저절로) → 타이틀 PRESS(`data-prompt-frame`) → 키 → 메인 메뉴 바퀴 칸(`스페셜`). 로고 · 타이틀 연출 시간이 들어 있다
//  - 나리 관리(키로): 저장을 깔고 바로가기 없이 메뉴 → [게임시작] → [최근게임] → 관리 105 (`command-bar`)
//  - 관리 · 타석: 장면 바로가기 `nari-management` · `general-bat` 이 ready 를 적은 때(장면 표의 고정 기다림 포함)
//  - 막힘: 50ms 넘는 주 스레드 틈의 (틈 − 50ms) 합 (TBT 꼴, setTimeout 고리로 잰다 — 두 브라우저 같은 잣대)
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { chromium, webkit } from 'playwright'
import { DEVICES, BASE_URL } from './lib/scene.mjs'
import { chromiumExecutable } from './lib/browsers.mjs'

const RTT_MS = 150
const DOWN_BPS = (1.6 * 1000 * 1000) / 8
const UP_BPS = (750 * 1000) / 8
const RUNS = Number(process.env.PERF_RUNS ?? 2)
/** `off` 면 망을 늦추지 않는다(연출 시간만 남는 바닥값). `rtt` 면 왕복 150ms 만(대역 제한 없음 — r306 다시 방문 표와 같은 조건, 크로미움만) */
const NET = process.env.PERF_NET ?? 'slow4g'
/** 다시 방문을 잴 장면 바로가기 (쉼표, 크로미움만 — 웹킷은 라우트로 늦춰 HTTP 캐시가 꺼진다) */
const REVISIT = (process.env.PERF_REVISIT ?? '').split(',').filter(Boolean)
/** 1 이면 켤 때 길 · 나리 키 길 · 장면 첫 방문을 건너뛴다(다시 방문만) */
const REVISIT_ONLY = process.env.PERF_REVISIT_ONLY === '1'
/** 크로미움 CPU 늦추기 배율 (CDP `Emulation.setCPUThrottlingRate`) — 느린 폰 꼴로 주 스레드 막힘을 볼 때 4 */
const CPU = Number(process.env.PERF_CPU ?? 1)
/** 1 이면 웹폰트 CDN(Galmuri, 다른 곳)도 받는다 — 기본은 다른 e2e 도우미처럼 끊는다 */
const CDN = process.env.PERF_CDN === '1'
const ONLY = process.env.PERF_ONLY
/** 켤 때 길은 바로가기가 없는 배포 빌드로 잰다(e2e 빌드는 그리기 전에 진행기 덩이를 한 번 더 받는다) — 없으면 BASE_URL */
const BOOT_URL = process.env.PERF_BOOT_URL ?? BASE_URL
/** 잴 장면 바로가기 (쉼표) */
const SCENES = (process.env.PERF_SCENES ?? 'nari-management,general-bat').split(',').filter(Boolean)

const BROWSERS = [
  { browserName: 'chromium', device: 'desktop' },
  { browserName: 'webkit', device: 'iphone' },
].filter((run) => ONLY === undefined || run.browserName === ONLY)

/** 막힘 재기 — 문서보다 먼저 단다 */
const BLOCK_PROBE = `(() => {
  const state = { blocked: 0, longest: 0, last: performance.now() }
  window.__perfBlock = state
  const loop = () => {
    const now = performance.now()
    const gap = now - state.last
    if (gap > 50) { state.blocked += gap - 50; state.longest = Math.max(state.longest, gap) }
    state.last = now
    setTimeout(loop, 0)
  }
  setTimeout(loop, 0)
})()`

const TEXT_TYPES = /javascript|css|json|html|svg|text/

/** 웹킷 — 라우트로 느린 4G. 줄 하나를 차례로 나눠 쓴다(받는 끝 시각을 이어 붙인다) */
async function throttleByRoute(page, tally) {
  let linkFreeAt = 0
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (!CDN && /cdn\.jsdelivr\.net/.test(url)) return route.abort()
    const sentAt = Date.now()
    let response
    try {
      response = await route.fetch()
    } catch {
      return route.abort()
    }
    const body = await response.body()
    const type = response.headers()['content-type'] ?? ''
    const bytes = TEXT_TYPES.test(type) && body.length > 1024 ? gzipSync(body).length : body.length
    const isOff = NET === 'off'
    const firstByteAt = isOff ? sentAt : sentAt + RTT_MS + Math.round(((route.request().postDataBuffer()?.length ?? 0) / UP_BPS) * 1000)
    const start = Math.max(firstByteAt, linkFreeAt)
    const doneAt = isOff ? start : start + (bytes / DOWN_BPS) * 1000
    linkFreeAt = doneAt
    tally.requests += 1
    tally.bytes += bytes + 300
    tally.byKind[kindOf(url)] = (tally.byKind[kindOf(url)] ?? 0) + bytes
    const wait = doneAt - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    await route.fulfill({ response, body })
  })
}

function kindOf(url) {
  const path = new URL(url).pathname
  if (/\.js$/.test(path)) return 'js'
  if (/\.css$/.test(path)) return 'css'
  if (/\.png$/.test(path)) return 'png'
  if (/\.json$/.test(path)) return 'json'
  if (/\.(mp3|m4a|ogg|wav|mid|mmf)$/.test(path)) return 'sound'
  if (/\.(woff2?|ttf)$/.test(path)) return 'font'
  return 'other'
}

/** 크로미움 — CDN 끊기는 라우트 대신 실행 인자로(라우트가 걸리면 HTTP 캐시가 꺼진다). 닫힌 포트 9 라 곧바로 실패한다 */
const CHROMIUM_ARGS = CDN ? [] : ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9']

/** 크로미움 — CDP 로 느린 4G, 받은 바이트는 encodedDataLength. 캐시에서 꺼낸 것은 요청으로 세지 않는다 */
async function throttleByCdp(page, tally) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
  if (NET === 'rtt') await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: RTT_MS, downloadThroughput: -1, uploadThroughput: -1,
  })
  else if (NET !== 'off') await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: RTT_MS, downloadThroughput: DOWN_BPS, uploadThroughput: UP_BPS,
  })
  const urls = new Map()
  const cached = new Set()
  cdp.on('Network.requestWillBeSent', (event) => urls.set(event.requestId, event.request.url))
  cdp.on('Network.requestServedFromCache', (event) => cached.add(event.requestId))
  cdp.on('Network.responseReceived', (event) => {
    if (event.response.fromDiskCache || event.response.fromServiceWorker || event.response.fromPrefetchCache) cached.add(event.requestId)
    else if (event.response.status === 304) tally.notModified += 1
  })
  cdp.on('Network.loadingFinished', (event) => {
    const url = urls.get(event.requestId) ?? ''
    if (url.startsWith('data:') || url === '' || cached.has(event.requestId)) return
    tally.requests += 1
    tally.bytes += event.encodedDataLength
    tally.byKind[kindOf(url)] = (tally.byKind[kindOf(url)] ?? 0) + event.encodedDataLength
  })
}

async function openPage(browser, browserName, device) {
  // https 로 띄운 HTTP/2 시험 서버(자체 서명 인증서)도 열게 (r322)
  const context = await browser.newContext({ ...DEVICES[device], ignoreHTTPSErrors: true })
  const page = await context.newPage()
  await page.addInitScript(BLOCK_PROBE)
  const tally = { requests: 0, bytes: 0, byKind: {}, notModified: 0 }
  if (browserName === 'chromium') await throttleByCdp(page, tally)
  else await throttleByRoute(page, tally)
  if (browserName === 'chromium' && CPU > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, tally, errors }
}

async function snapshot(page, tally, started) {
  const block = await page.evaluate(() => window.__perfBlock)
  return {
    ms: Date.now() - started,
    requests: tally.requests,
    kb: Math.round(tally.bytes / 1024),
    js: Math.round((tally.byKind.js ?? 0) / 1024),
    blocked: Math.round(block.blocked),
    longest: Math.round(block.longest),
    notModified: tally.notModified,
  }
}

/** 셈을 0 으로 — 다시 방문만 세려고 */
function resetTally(tally) {
  tally.requests = 0
  tally.bytes = 0
  tally.byKind = {}
  tally.notModified = 0
}

/** 이용안내 글이 보일 때 — 글줄이 서고 웹폰트(display: block — 오기 전에는 글자가 안 보인다)까지 왔을 때 */
async function waitNoticeVisible(page) {
  await page.waitForFunction(
    () => document.querySelector('[data-part="글줄"]') !== null && document.fonts.status === 'loaded',
    null,
    { timeout: 120000, polling: 50 },
  )
}

/** 켤 때 길 — 이용안내 · 메인 메뉴 */
async function measureBoot(browser, browserName, device) {
  const { context, page, tally, errors } = await openPage(browser, browserName, device)
  const started = Date.now()
  await page.goto(BOOT_URL, { waitUntil: 'commit' })
  // 자산 묶음 받기 화면(r322 `app/assetPacks`)이 끝난 때 — 묶음이 없는 빌드면 이용안내와 같은 때로 잡힌다
  await page.waitForFunction(
    () => document.documentElement.dataset.assetPacks !== undefined || document.querySelector('[data-part="글줄"]') !== null,
    null,
    { timeout: 300000, polling: 50 },
  )
  const packs = await snapshot(page, tally, started)
  await waitNoticeVisible(page)
  const notice = await snapshot(page, tally, started)
  await page.keyboard.press('Enter', { delay: 40 })
  await page.waitForSelector('[data-prompt-frame]', { timeout: 120000 })
  const title = await snapshot(page, tally, started)
  await page.keyboard.press('Enter', { delay: 40 })
  await page.waitForSelector('button[aria-label="스페셜"]', { state: 'attached', timeout: 120000 })
  const menu = await snapshot(page, tally, started)
  // 메뉴에 머무는 동안 다음 화면 몫이 얼마나 오는지 — 3초 뒤
  await page.waitForTimeout(3000)
  const menuIdle = await snapshot(page, tally, started)
  await context.close()
  return { packs, notice, title, menu, menuIdle, errors }
}

/** 픽스처 저장을 쪽이 열리기 전에 깐다 (처음 한 번만 — 앱이 쓴 저장을 다시 덮지 않게) */
async function seedFixture(page, name) {
  const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
  await page.addInitScript((storage) => {
    if (sessionStorage.getItem('perf-seeded') !== null) return
    sessionStorage.setItem('perf-seeded', '1')
    for (const [key, value] of Object.entries(storage)) {
      const isRaw = typeof value === 'object' && value !== null && '$raw' in value
      localStorage.setItem(key, isRaw ? String(value.$raw) : JSON.stringify(value))
    }
  }, fixture.localStorage)
}

/** 목표가 설 때까지 키를 하나씩 — 한 번 누르고 `wait` 만큼 본다 */
async function pressUntil(page, selector, { key = 'Enter', wait = 1500, tries = 20 } = {}) {
  for (let index = 0; index < tries; index += 1) {
    await page.keyboard.press(key, { delay: 40 })
    try {
      await page.waitForSelector(selector, { state: 'attached', timeout: wait })
      return
    } catch {
      // 한 번 더
    }
  }
  throw new Error(`키를 눌러도 안 섰다: ${selector}`)
}

/**
 * 사람 길 — 나리 타자편 저장(`nari-y1`)을 깔고 바로가기 없이 켠다: 이용안내 → 타이틀 → 메인 메뉴 → [게임시작] → [최근게임] → 관리 105.
 * 모드 화면 덩이는 켤 때 길에서 받아 둔 것을 쓴다
 */
async function measureNariByKeys(browser, browserName, device) {
  const { context, page, tally, errors } = await openPage(browser, browserName, device)
  await seedFixture(page, 'nari-y1')
  const started = Date.now()
  await page.goto(BOOT_URL, { waitUntil: 'commit' })
  await waitNoticeVisible(page)
  await page.keyboard.press('Enter', { delay: 40 })
  await page.waitForSelector('[data-prompt-frame]', { timeout: 120000 })
  await page.keyboard.press('Enter', { delay: 40 })
  await page.waitForSelector('button[aria-label="스페셜"]', { state: 'attached', timeout: 120000 })
  await page.waitForTimeout(600)
  await pressUntil(page, 'button[aria-label="나만의리그"]')
  await pressUntil(page, '[data-testid="command-bar"]')
  const result = await snapshot(page, tally, started)
  await context.close()
  return { nariByKeys: result, errors }
}

/** 장면 바로가기 — 픽스처를 깐 채 그 장면까지 */
async function measureScene(browser, browserName, device, scene, fixture) {
  const { context, page, tally, errors } = await openPage(browser, browserName, device)
  const started = Date.now()
  await page.goto(`${BASE_URL}?scene=${scene}${fixture === undefined ? '' : `&fixture=${fixture}`}`, { waitUntil: 'commit' })
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.scene
    return state === 'ready' || state === 'error'
  }, null, { timeout: 180000, polling: 50 })
  const status = await page.evaluate(() => window.__scene)
  const result = await snapshot(page, tally, started)
  await context.close()
  if (status?.status !== 'ready') errors.push(`장면 ${scene}: ${status?.error}`)
  return { [scene]: result, errors }
}

/** 장면이 ready(또는 error)를 적을 때까지 */
async function waitScene(page) {
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.scene
    return state === 'ready' || state === 'error'
  }, null, { timeout: 180000, polling: 50 })
  return page.evaluate(() => window.__scene)
}

/**
 * 다시 방문 — 같은 맥락(HTTP 캐시 공유)에서 장면 바로가기를 한 번 열어 다 받은 뒤, 같은 주소를 다시 열어 두 번째를 잰다.
 * 픽스처는 바로가기가 쪽마다 다시 깐다. 요청 수는 망에 나간 것(304 포함)만 — 캐시에서 꺼낸 것은 뺀다.
 */
async function measureRevisit(browser, browserName, device, scene) {
  const { context, page, tally, errors } = await openPage(browser, browserName, device)
  const url = `${BASE_URL}?scene=${scene}`
  await page.goto(url, { waitUntil: 'commit' })
  await waitScene(page)
  // 장면이 선 뒤의 유휴 미리 받기까지 다 받게 둔다
  await page.waitForTimeout(3000)
  await page.goto('about:blank')
  resetTally(tally)
  const started = Date.now()
  await page.goto(url, { waitUntil: 'commit' })
  await page.evaluate(() => { window.__perfBlock.blocked = 0; window.__perfBlock.longest = 0 })
  const status = await waitScene(page)
  const result = await snapshot(page, tally, started)
  await context.close()
  if (status?.status !== 'ready') errors.push(`다시 방문 ${scene}: ${status?.error}`)
  return { [`${scene} 다시`]: result, errors }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

function mergeRuns(runs) {
  const out = {}
  for (const key of Object.keys(runs[0])) {
    if (key === 'errors') continue
    out[key] = {}
    for (const field of Object.keys(runs[0][key])) out[key][field] = median(runs.map((run) => run[key][field]))
  }
  return out
}

const results = {}
for (const { browserName, device } of BROWSERS) {
  const type = browserName === 'webkit' ? webkit : chromium
  const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
  const args = browserName === 'chromium' ? CHROMIUM_ARGS : []
  const browser = await type.launch({ headless: true, args, ...(executablePath === undefined ? {} : { executablePath }) })
  const runs = []
  for (let index = 0; index < RUNS; index += 1) {
    const boot = REVISIT_ONLY ? { errors: [] } : await measureBoot(browser, browserName, device)
    const nari = REVISIT_ONLY ? { errors: [] } : await measureNariByKeys(browser, browserName, device)
    // 장면 바로가기 — 기본은 나리 관리 · 첫 타석. general-bat 은 장면의 기본 픽스처라 개발 · 빌드가 같은 씨앗에서 같은 선공이다(r231).
    // PERF_BAT_FIXTURE 로 general-bat 의 픽스처를, PERF_SCENES(쉼표)로 잴 장면을 바꿀 수 있다
    const scenes = []
    if (!REVISIT_ONLY) for (const scene of SCENES) scenes.push(await measureScene(browser, browserName, device, scene, scene === 'general-bat' ? process.env.PERF_BAT_FIXTURE : undefined))
    if (browserName === 'chromium') for (const scene of REVISIT) scenes.push(await measureRevisit(browser, browserName, device, scene))
    const errors = [...boot.errors, ...nari.errors, ...scenes.flatMap((scene) => scene.errors)]
    if (errors.length > 0) console.log(`  ! ${browserName} 실행 ${index + 1}: ${errors.slice(0, 3).join(' / ')}`)
    runs.push(Object.assign({}, boot, nari, ...scenes))
    console.log(`  ${browserName} 실행 ${index + 1} 끝`)
  }
  await browser.close()
  results[browserName] = mergeRuns(runs)
}

console.log(`\n${NET === 'off' ? '망 그대로' : NET === 'rtt' ? `왕복 ${RTT_MS}ms (대역 제한 없음)` : `느린 4G (왕복 ${RTT_MS}ms · ${DOWN_BPS * 8 / 1e6}Mbps)`}${CPU > 1 ? ` · 크로미움 CPU ×${CPU}` : ''}${CDN ? ' · CDN 받음' : ''} · ${BASE_URL} · 실행 ${RUNS}번의 가운데 값`)
console.log('요청: chromium = 망 요청(캐시 켬, 캐시에서 꺼낸 것 뺌) · webkit = 라우트로 늦춤(캐시 꺼짐 — 다시 받은 것도 셈)')
console.log('| 브라우저 | 지점 | 시간 ms | 요청 | 그중 304 | 받은 KB | 그중 JS KB | 막힘 ms | 가장 긴 틈 ms |')
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|')
const LABELS = {
  packs: '자산 묶음 받기 끝', notice: '이용안내', title: '타이틀 PRESS', menu: '메인 메뉴', menuIdle: '메뉴 +3초', nariByKeys: '나리 관리(키로)', 'nari-management': '나리 관리(바로가기)', 'general-bat': '첫 타석(바로가기)',
}
for (const [browserName, points] of Object.entries(results)) {
  for (const [key, value] of Object.entries(points)) {
    console.log(`| ${browserName === 'webkit' ? 'webkit(캐시 꺼짐)' : browserName} | ${LABELS[key] ?? key} | ${value.ms} | ${value.requests} | ${value.notModified} | ${value.kb} | ${value.js} | ${value.blocked} | ${value.longest} |`)
  }
}
