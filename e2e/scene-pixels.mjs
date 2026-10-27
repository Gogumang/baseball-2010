// **두 서버의 장면 화면을 픽셀 단위로 견준다** — 자산만 바꾼 판(예: r311 PNG 팔레트 다시 쓰기 · JSON 묶음)이 화면을 바꾸지 않았는지.
//
//   PIXELS_A=http://127.0.0.1:5711/ PIXELS_B=http://127.0.0.1:5641/ yarn node e2e/scene-pixels.mjs              # 장면 표 전부 × chromium · webkit 아이폰
//   PIXELS_A=… PIXELS_B=… yarn node e2e/scene-pixels.mjs general-bat derby-start                             # 몇 개만
//   PIXELS_ONLY=webkit PIXELS_SETTLE=2000 …                                                                   # 한 브라우저 · ready 뒤 더 돌릴 가상 ms
//
// 같은 틱에서 찍기: Playwright 가짜 시계(`page.clock`)를 쪽이 열리기 전에 멈춰 두고, **망 요청이 다 끝난 뒤에만** 시계를 STEP ms 씩
// 민다. 그래서 두 서버 모두 "청한 그림 · JSON 은 다음 걸음 전에 와 있다" 는 같은 조건에서 같은 틱 수만큼 돈다(그림이 늦게 와서
// 갈리는 일이 없다). `data-scene=ready` 뒤 SETTLE ms 를 더 밀고 찍는다. CSS 애니는 `animations: 'disabled'` 로 멈춘다.
//
// 장면마다 센다: 다른 픽셀 수(바이트가 같으면 0) · 쪽 오류 · 콘솔 오류 · 4xx/5xx 응답 · 실패한 요청(웹폰트 CDN 제외) ·
// 그림 오류(`Image` · `<img>` error 사건, 다 받았는데 naturalWidth 0 인 `<img>`) · 스프라이트 JSON 낱개 요청 수 · 묶음 요청 수.
// 다른 픽셀 · 오류가 하나라도 있으면 끝 코드 1. 찍은 그림은 `e2e/.run/pixels/` 에 둔다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, webkit } from 'playwright'
import { DEVICES } from './lib/scene.mjs'
import { chromiumExecutable } from './lib/browsers.mjs'

const A = process.env.PIXELS_A
const B = process.env.PIXELS_B
if (A === undefined || B === undefined) throw new Error('PIXELS_A · PIXELS_B (두 서버 주소) 가 필요하다')
const ONLY = process.env.PIXELS_ONLY
const STEP = Number(process.env.PIXELS_STEP ?? 50)
const SETTLE = Number(process.env.PIXELS_SETTLE ?? 1500)
/** 가상 시간 한도 — 공을 여러 번 보내는 장면은 넉넉히 */
const LIMIT = { 'nari-burst-result': 240000, 'mission-result': 240000 }
const OUT = new URL('./.run/pixels/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const SCENES_FILE = new URL('../src/app/dev/scenes.ts', import.meta.url)
function sceneNames() {
  const source = readFileSync(SCENES_FILE, 'utf8')
  const table = source.slice(source.indexOf('export const SCENES'))
  return [...table.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: \{/gm)].map((match) => match[1])
}

const CDN = /cdn\.jsdelivr\.net/

/** 그림 오류 귀 — 쪽보다 먼저 단다 */
const IMAGE_PROBE = `(() => {
  const state = { errors: [] }
  window.__imageProbe = state
  const note = (src) => { if (src && !/cdn\\.jsdelivr\\.net/.test(src)) state.errors.push(String(src).slice(0, 160)) }
  const Original = window.Image
  window.Image = function Image(width, height) {
    const image = new Original(width, height)
    image.addEventListener('error', () => note(image.currentSrc || image.src))
    return image
  }
  window.Image.prototype = Original.prototype
  document.addEventListener('error', (event) => {
    const target = event.target
    if (target instanceof HTMLImageElement) note(target.currentSrc || target.src)
  }, true)
})()`

async function openPage(browser, browserName, device) {
  const context = await browser.newContext(DEVICES[device])
  const page = await context.newPage()
  const stats = { pageErrors: [], consoleErrors: [], badResponses: [], failed: [], spriteJson: 0, bundle: 0, inFlight: 0 }
  if (browserName !== 'chromium') await page.route(CDN, (route) => route.abort())
  page.on('pageerror', (error) => stats.pageErrors.push(error.message.slice(0, 200)))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // 웹폰트 CDN 을 일부러 끊어 생기는 줄
    if (/ERR_FAILED|ERR_CONNECTION_REFUSED|ERR_NAME|cdn\.jsdelivr|Failed to load resource: (net::|The network connection)|access control checks/.test(text) && !/sprites\//.test(text)) return
    stats.consoleErrors.push(text.slice(0, 200))
  })
  page.on('request', (request) => {
    stats.inFlight += 1
    const url = request.url()
    if (/\/sprites\/sprite-json\.bundle\.json/.test(url)) stats.bundle += 1
    else if (/\/sprites\/.+\.json(\?|$)/.test(url)) stats.spriteJson += 1
  })
  const settle = () => { stats.inFlight -= 1 }
  page.on('requestfinished', async (request) => {
    settle()
    const response = await request.response().catch(() => null)
    if (response !== null && response.status() >= 400) stats.badResponses.push(`${response.status()} ${request.url()}`)
  })
  page.on('requestfailed', (request) => {
    settle()
    if (!CDN.test(request.url())) stats.failed.push(`${request.failure()?.errorText ?? '?'} ${request.url()}`)
  })
  await page.addInitScript(IMAGE_PROBE)
  await page.clock.install({ time: new Date('2026-10-27T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'))
  return { context, page, stats }
}

/** 망 요청이 다 끝나고 잠깐 조용할 때까지 (실제 시간) */
async function waitQuiet(page, stats) {
  let quiet = 0
  for (let tries = 0; tries < 2000 && quiet < 3; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 15))
    quiet = stats.inFlight <= 0 ? quiet + 1 : 0
  }
  // 받은 그림의 onload · JSON 풀기 같은 실제 시간 일이 돌 틈
  // (쪽의 setTimeout 은 가짜 시계에 묶여 있으니 MessageChannel 로 한 바퀴)
  await page.evaluate(() => new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve(null)
    channel.port2.postMessage(0)
  })).catch(() => {})
}

async function sceneState(page) {
  return page.evaluate(() => document.documentElement.dataset.scene ?? null).catch(() => null)
}

/** 가짜 시계를 STEP 씩 밀며 ready → SETTLE 더 → 찍기 */
async function capture(browser, browserName, device, base, scene, label, target = 0) {
  const { context, page, stats } = await openPage(browser, browserName, device)
  let error = null
  let virtual = 0
  try {
    await page.goto(`${base}?scene=${scene}`, { waitUntil: 'commit' })
    await page.waitForLoadState('domcontentloaded')
    const limit = LIMIT[scene] ?? 120000
    let state = null
    while (virtual < limit) {
      await waitQuiet(page, stats)
      state = await sceneState(page)
      if (state === 'error' || (state === 'ready' && virtual >= target)) break
      await page.clock.runFor(STEP)
      virtual += STEP
    }
    if (state !== 'ready') {
      const status = await page.evaluate(() => window.__scene).catch(() => null)
      throw new Error(`장면이 안 섰다 (${state}, 가상 ${virtual}ms): ${status?.error ?? ''}`)
    }
    for (let extra = 0; extra < SETTLE; extra += STEP) {
      await page.clock.runFor(STEP)
      await waitQuiet(page, stats)
    }
    virtual += SETTLE
  } catch (caught) {
    error = String(caught).slice(0, 300)
  }
  const shotPath = `${OUT}${browserName}-${scene}-${label}.png`
  const png = await page.screenshot({ path: shotPath, animations: 'disabled' }).catch(() => null)
  const images = await page.evaluate(() => ({
    errors: window.__imageProbe?.errors ?? [],
    broken: [...document.images].filter((image) => image.getAttribute('src') && image.complete && image.naturalWidth === 0).map((image) => image.src.slice(0, 160)),
  })).catch(() => ({ errors: ['쪽을 못 읽음'], broken: [] }))
  await context.close()
  return { png, error, virtual, stats, images }
}

/** 두 PNG 의 다른 픽셀 수 — 바이트가 같으면 0, 아니면 도우미 쪽에서 풀어 센다 */
async function diffPixels(helper, a, b) {
  if (a === null || b === null) return -1
  if (Buffer.compare(a, b) === 0) return 0
  return helper.evaluate(async ([left, right]) => {
    const load = async (base64) => {
      const image = new Image()
      image.src = `data:image/png;base64,${base64}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, canvas.width, canvas.height)
    }
    const x = await load(left)
    const y = await load(right)
    if (x.width !== y.width || x.height !== y.height) return -2
    let count = 0
    for (let at = 0; at < x.data.length; at += 4) {
      if (x.data[at] !== y.data[at] || x.data[at + 1] !== y.data[at + 1] || x.data[at + 2] !== y.data[at + 2] || x.data[at + 3] !== y.data[at + 3]) count += 1
    }
    return count
  }, [a.toString('base64'), b.toString('base64')])
}

/**
 * 한쪽의 문제 — 못 받은 · 못 푼 자원은 서버 주소를 뗀 경로 집합으로(서버마다 404 글 · SPA 대체 응답이 달라도 같은 경로면 같은 문제),
 * 쪽 오류 · 콘솔 오류는 글로. "Failed to load resource" 콘솔 줄은 주소가 없어 경로 쪽과 겹치므로 뺀다.
 */
function problemsOf(side, base) {
  const strip = (url) => url.replace(/^\S+\s/, '').replace(base, '').replace(/^https?:\/\/[^/]+\//, '')
  const paths = new Set([
    ...side.stats.badResponses.map(strip), ...side.stats.failed.map(strip),
    ...side.images.errors.map(strip), ...side.images.broken.map(strip),
  ])
  const messages = new Set([...side.stats.pageErrors, ...side.stats.consoleErrors.filter((text) => !text.startsWith('Failed to load resource'))])
  return { paths: [...paths].sort(), messages: [...messages] }
}

const isOk = (row) => row.diff === 0 && row.errorA === null && row.errorB === null && row.newPaths.length === 0 && row.newMessages.length === 0

const asked = process.argv.slice(2)
const names = asked.length > 0 ? asked : sceneNames()
const RUNS = [
  { browserName: 'chromium', device: 'desktop' },
  { browserName: 'webkit', device: 'iphone' },
].filter((run) => ONLY === undefined || run.browserName === ONLY)

const rows = []
const started = Date.now()
for (const { browserName, device } of RUNS) {
  const type = browserName === 'webkit' ? webkit : chromium
  const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
  const browser = await type.launch({
    headless: true,
    ...(browserName === 'chromium' ? { args: ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9'] } : {}),
    ...(executablePath === undefined ? {} : { executablePath }),
  })
  const helper = await (await browser.newContext()).newPage()
  await helper.setContent('<!doctype html><title>diff</title>')
  for (const scene of names) {
    let a = await capture(browser, browserName, device, A, scene, 'a')
    let b = await capture(browser, browserName, device, B, scene, 'b')
    let diff = await diffPixels(helper, a.png, b.png)
    // ready 가 선 가상 시각이 한 걸음 갈리면(웹킷에서 가끔 — 같은 서버끼리도 갈린다) 둘 다 늦은 쪽 시각까지 민 화면으로 다시 견준다
    let aligned = false
    for (let retry = 0; retry < 2 && diff !== 0 && a.virtual !== b.virtual && a.error === null && b.error === null; retry += 1) {
      const target = Math.max(a.virtual, b.virtual) - SETTLE
      a = await capture(browser, browserName, device, A, scene, 'a', target)
      b = await capture(browser, browserName, device, B, scene, 'b', target)
      diff = await diffPixels(helper, a.png, b.png)
      aligned = true
    }
    const row = {
      browserName, scene, diff, aligned, virtualA: a.virtual, virtualB: b.virtual,
      errorA: a.error, errorB: b.error,
      jsonA: a.stats.spriteJson, jsonB: b.stats.spriteJson, bundleA: a.stats.bundle, bundleB: b.stats.bundle,
      problemsA: problemsOf(a, A), problemsB: problemsOf(b, B),
    }
    // B 에만 있는 문제 — 이번 바꿈이 새로 낸 것
    row.newPaths = row.problemsB.paths.filter((path) => !row.problemsA.paths.includes(path))
    row.newMessages = row.problemsB.messages.filter((text) => !row.problemsA.messages.includes(text))
    rows.push(row)
    const ok = isOk(row)
    const known = row.problemsA.paths.length + row.problemsA.messages.length
    console.log(`${ok ? 'ok  ' : 'DIFF'} ${browserName.padEnd(8)} ${scene.padEnd(28)} 다른 픽셀 ${String(diff).padStart(6)} · 가상 ${a.virtual}/${b.virtual}ms${aligned ? '(맞춤)' : ''}` +
      ` · 새 문제 ${row.newPaths.length + row.newMessages.length} (둘 다 있던 것 ${known}) · JSON 낱개 A ${row.jsonA} B ${row.jsonB} · 묶음 A ${row.bundleA} B ${row.bundleB}` +
      `${row.errorA ? ` · A: ${row.errorA}` : ''}${row.errorB ? ` · B: ${row.errorB}` : ''}` +
      `${row.newPaths.length + row.newMessages.length > 0 ? ` · B 에만: ${[...row.newPaths, ...row.newMessages].slice(0, 5).join(' | ')}` : ''}` +
      `${known > 0 ? ` · 둘 다: ${[...row.problemsA.paths, ...row.problemsA.messages].slice(0, 5).join(' | ')}` : ''}`)
  }
  await browser.close()
}
writeFileSync(`${OUT}report.json`, `${JSON.stringify(rows, null, 2)}\n`)
const bad = rows.filter((row) => !isOk(row))
console.log(`\n${rows.length - bad.length}/${rows.length} 같음 · 새 오류 없음 · ${((Date.now() - started) / 60000).toFixed(1)}분 (A ${A} · B ${B})`)
process.exit(bad.length === 0 ? 0 : 1)
