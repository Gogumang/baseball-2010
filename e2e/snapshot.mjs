// **경기 중간 스냅샷** — 실제로 공을 보내야 닿는 장면(장면 표의 `snapshot`)을 그 순간 그대로 떠 두고(`e2e/snapshots/<장면>.json.gz`),
// `?scene=` 바로가기가 단계를 밟지 않고 곧장 되살린다(`src/app/dev/sessionSnapshot.ts`).
//
//   pnpm e2e:snapshot                          # 뜨기 — 장면 표의 snapshot 장면 전부 (e2e 빌드 → preview 4920, 가짜 시계로 실제 진행)
//   pnpm e2e:snapshot nari-burst-result        # 장면만 골라 뜨기
//   pnpm e2e:snapshot verify                   # 같음 확인 — 실제로 진행한 쪽(A) vs 그 순간을 되살린 쪽(B), 그 뒤 몇 걸음도
//   pnpm e2e:snapshot verify mission-result
//   E2E_SNAPSHOT_URL=http://127.0.0.1:4921/ …  # 이미 띄운 서버 (빌드 안 함)
//   E2E_SNAPSHOT_RUNS=chromium:desktop,webkit:iphone pnpm e2e:snapshot verify   # 같음 확인 브라우저:기기 (기본 이 둘)
//
// 낡음: 씨앗 · 난수 차례 · 장면 단계 · 부품 훅 차례가 바뀌면 스냅샷이 낡는다. 훅 차례가 다르면 되살리기가 "낡았다" 로 실패하고
// (`pnpm e2e:quick` 은 그 장면을 실제 진행 길로 다시 연다), 값만 달라진 낡음은 `verify` 의 "파일 vs 지금 뜬 것" 줄이 알린다. 다시 뜬다.
//
// 가짜 시계: 두 쪽 모두 Playwright `page.clock` 을 멈춰 두고 망 요청이 다 끝난 뒤에만 STEP ms 씩 민다(`scene-pixels.mjs` 와 같은 꼴) —
// 실제 진행이 판마다 같은 틱에 닿고, 같음 확인은 두 쪽을 **같은 앱 틱**에 맞춰 견준다.
//
// 같음 확인이 보는 것 (하나라도 다르면 끝 코드 1):
// - 핵심 상태: 화면 · 커리어(진행 중 · 저장) · 진행 칸(`progress`) · 투수편 커리어 · 시즌 장면 · 미션 세션 데이터 · 난수 씨앗 칸 · localStorage
// - 화면 판 스크린샷 — 같은 틱에 맞춘 뒤 픽셀 단위
// - 그 뒤 걸음(장면마다 `FOLLOW`): 같은 틱에 키를 누르고 같은 틱 수만큼 민 뒤 위 둘을 다시
// - 부품 자리마다 훅 칸 해시가 다른 수(참고 — 자리 몇 개와 처음 다른 값을 찍는다)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { chromium, webkit } from 'playwright'
import { startE2ePreview } from './lib/preview.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const SNAPSHOT_DIR = join(ROOT, 'e2e/snapshots')
const OUT = join(ROOT, 'e2e/.run/snapshot')
mkdirSync(SNAPSHOT_DIR, { recursive: true })
mkdirSync(OUT, { recursive: true })
const PORT = Number(process.env.E2E_SNAPSHOT_PORT ?? 4920)
const STEP = Number(process.env.E2E_SNAPSHOT_STEP ?? 50)
const LIMIT_MS = 300000

const { DEVICES } = await import('./lib/scene.mjs')
const { chromiumExecutable } = await import('./lib/browsers.mjs')

/** 장면 표에서 `snapshot:` 이 있는 장면 (`src/app/dev/scenes/<도메인>.ts`) */
const { sceneCatalog } = await import('./lib/catalog.mjs')
const snapshotScenes = () =>
  sceneCatalog()
    .filter((scene) => scene.snapshot !== null)
    .map((scene) => scene.name)

/**
 * 같음 확인의 그 뒤 걸음 — `key` 를 같은 틱에 누르고 `ticks` 틱 민다. 결과 창 · 판을 닫고 정산 · 다음 화면까지
 */
const FOLLOW = {
  'nari-burst-result': [
    { key: 'Enter', ticks: 60 },
    { key: 'Enter', ticks: 90 },
    { key: 'Enter', ticks: 90 },
    { key: 'Enter', ticks: 90 },
  ],
  'mission-result': [
    { key: 'Enter', ticks: 60 },
    { key: 'Enter', ticks: 90 },
    { key: 'Enter', ticks: 90 },
  ],
}

const CDN = /cdn\.jsdelivr\.net/

async function openPage(browser, device, { inject } = {}) {
  const context = await browser.newContext(DEVICES[device])
  const page = await context.newPage()
  const stats = { inFlight: 0, pageErrors: [] }
  await page.route(CDN, (route) => route.abort())
  page.on('pageerror', (error) => stats.pageErrors.push(error.message.slice(0, 300)))
  page.on('request', () => {
    stats.inFlight += 1
  })
  page.on('requestfinished', () => {
    stats.inFlight -= 1
  })
  page.on('requestfailed', () => {
    stats.inFlight -= 1
  })
  if (inject !== undefined)
    await page.addInitScript((text) => {
      window.__snapshotOverride = JSON.parse(text)
    }, JSON.stringify(inject))
  // React 스케줄러를 가짜 시계 위로 (r355) — 스케줄러는 `setImmediate` 가 있으면 그것으로, 없으면 MessageChannel(실제 시간)로 일을 미룬다.
  // MessageChannel 이면 React 커밋 · effect 가 가짜 시계의 타이머 사이 어느 틈에 도느냐가 실제 시간에 따라 갈려, 그 안에서 읽는
  // `performance.now()`(창이 선 시각 → 멈춘 ms 합 따위)가 쪽마다 수십 ms 달라졌다. 가짜 setTimeout(0) 이면 가짜 시각 · 차례가 늘 같다.
  // 시험 브라우저에만 넣는 것이라 게임 코드 · 틱 시계는 그대로다
  await page.addInitScript(() => {
    window.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args)
  })
  await page.clock.install({ time: new Date('2026-10-27T00:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-27T00:00:01Z'))
  return { context, page, stats }
}

/** 망 요청이 다 끝나고 잠깐 조용할 때까지 (실제 시간) — `scene-pixels.mjs` 와 같다 */
async function waitQuiet(page, stats) {
  let quiet = 0
  for (let tries = 0; tries < 2000 && quiet < 3; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    quiet = stats.inFlight <= 0 ? quiet + 1 : 0
  }
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          const channel = new MessageChannel()
          channel.port1.onmessage = () => resolve(null)
          channel.port2.postMessage(0)
        }),
    )
    .catch(() => {})
}

/** 장면이 ready · error 가 될 때까지 가짜 시계를 민다 */
async function driveToReady(page, stats) {
  let virtual = 0
  while (virtual < LIMIT_MS) {
    await waitQuiet(page, stats)
    const state = await page.evaluate(() => document.documentElement.dataset.scene ?? null).catch(() => null)
    if (state === 'ready') return virtual
    if (state === 'error') break
    await page.clock.runFor(STEP)
    virtual += STEP
  }
  const status = await page.evaluate(() => window.__scene).catch(() => null)
  throw new Error(`장면이 안 섰다 (가상 ${virtual}ms): ${status?.error ?? status?.status ?? '?'} · 단계 ${status?.steps?.slice(-3).join(' → ')}`)
}

/** 앱 틱 `tick` 머리 + `offset` ms 까지 민다 (틱마다 망 조용함을 기다리며) */
async function advanceToTick(page, stats, tick, offset = 1) {
  for (;;) {
    const { now, start } = await page.evaluate((target) => ({ now: window.__snapshot.now(), start: window.__snapshot.tickStart(target) }), tick)
    const ms = Math.ceil(start - now) + offset
    if (ms <= 0) return
    await page.clock.runFor(Math.min(ms, STEP))
    await waitQuiet(page, stats)
  }
}

/**
 * 늦게 오는 재료(그림 받기 · 칠하기 · 글꼴)가 다 올 때까지 (실제 시간) — 도착 수(`window.__snapshot.assets`)가 잠깐 그대로고 망이
 * 조용하면 끝. 재료는 실제 시간에 오고 그림은 가짜 시계의 그림 틀에서만 다시 그려지므로, 견주기 전에 기다려야 두 쪽 그림이 같은
 * 재료로 그려진다(r355 — 실제 진행 쪽은 오래 돌며 이미 받아 둔 그림을, 되살린 쪽은 그 틱에 처음 청한다)
 */
async function settleAssets(page, stats) {
  let last = -1
  let still = 0
  for (let tries = 0; tries < 300 && still < 3; tries += 1) {
    await waitQuiet(page, stats)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const count = await page.evaluate(() => window.__snapshot.assets())
    still = count === last ? still + 1 : 0
    last = count
  }
}

/** Playwright 가짜 시계의 그림 틀(rAF) 간격 */
const FRAME_MS = 16

/**
 * 두 쪽을 틱 `tick` 에 맞춘다 — 그 틱 첫 그림 틀 뒤까지 민 뒤 재료를 기다리고, 그 틱 끝 2ms 앞까지 더 민다(그 사이 그림 틀이 셋 넘게 돌아
 * 늦게 온 재료로 다시 그린다 — 틱 안에서 게임 상태는 안 바뀐다). 뒤로 늘 오는 유휴 미리 받기는 지금 그림과 상관없다
 */
async function alignAtTick(sides, tick) {
  const length = await sides[0].page.evaluate((at) => window.__snapshot.tickStart(at + 1) - window.__snapshot.tickStart(at), tick)
  // 그 틱의 첫 그림 틀(가짜 시계의 그림 틀은 16ms 격자)이 돈 뒤 — 그 그림이 처음 청한 재료까지 기다린다
  await Promise.all(sides.map((side) => advanceToTick(side.page, side.stats, tick, Math.min(FRAME_MS + 1, Math.floor(length / 2)))))
  await Promise.all(sides.map((side) => settleAssets(side.page, side.stats)))
  await Promise.all(sides.map((side) => advanceToTick(side.page, side.stats, tick, Math.max(1, Math.floor(length) - 2))))
}

const tickOf = (page) => page.evaluate(() => window.__snapshot.tick())
const digestOf = (page) => page.evaluate(() => window.__snapshot.digest())
/**
 * 화면 판 스크린샷 — 찍기 전에 판을 새 층으로 올려(`will-change: transform`) 통째로 다시 그리게 한다(r355). 크로미움은 바뀌지 않은 자리를
 * 다시 칠하지 않아, 실제 진행 쪽에만 지나간 그림(글꼴이 바뀌기 전 글자 따위)의 잔상 점이 남았다 — DOM 은 두 쪽이 같은데 픽셀 6 개가
 * 갈렸다(엔딩). 찍은 뒤 되돌린다 — 게임 상태는 안 건드린다
 */
const shotOf = async (page, path) => {
  const setLayer = (value) =>
    page.evaluate((willChange) => {
      document.querySelector('[data-original-screen]').style.willChange = willChange
    }, value)
  await setLayer('transform')
  const shot = await page.locator('[data-original-screen]').first().screenshot({ path, animations: 'disabled' })
  await setLayer('')
  return shot
}

// ─── 뜨기 ───

async function captureScene(browser, base, scene) {
  const { context, page, stats } = await openPage(browser, 'desktop')
  try {
    const started = Date.now()
    await page.goto(`${base}?scene=${scene}&real=1&capture=1`, { waitUntil: 'commit' })
    const virtual = await driveToReady(page, stats)
    const snapshot = await page.evaluate(() => window.__capturedSnapshot ?? null)
    if (snapshot === null) throw new Error('뜬 스냅샷이 없다 (window.__capturedSnapshot)')
    if (stats.pageErrors.length > 0) throw new Error(`pageerror: ${stats.pageErrors[0]}`)
    const text = JSON.stringify(snapshot)
    const packed = gzipSync(text, { level: 9 })
    writeFileSync(join(SNAPSHOT_DIR, `${scene}.json.gz`), packed)
    console.log(
      `떴다 ${scene.padEnd(22)} 가상 ${(virtual / 1000).toFixed(1)}s · 실제 ${((Date.now() - started) / 1000).toFixed(1)}s · 부품 ${snapshot.fibers.length} · 값 ${snapshot.values.length} · ${(text.length / 1024).toFixed(0)}KB (gzip ${(packed.length / 1024).toFixed(0)}KB) · 앱 틱 ${snapshot.appTick} · 난수 칸 ${snapshot.random}`,
    )
  } finally {
    await context.close()
  }
}

// ─── 같음 확인 ───

/** 실제 시각(ms) 칸 — 틱이 아니라 ms 로 세는 모듈 칸(멈춘 시간 합 · 결과 배경 시계 · 플레이 시계) */
const MS_FIELD = /^\.o\.(frozenTotal|frozenAgo|backdropAgo)\b/

/** JSON 두 값의 처음 다른 자리 몇 개 */
function firstDiffs(a, b, path = '', out = [], limit = 6) {
  if (out.length >= limit) return out
  if (JSON.stringify(a) === JSON.stringify(b)) return out
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${path || '(값)'}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`)
    return out
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) firstDiffs(a[key], b[key], `${path}.${key}`, out, limit)
  return out
}

/** 두 요약을 견준다 — 핵심 차이 줄(실패)과 부품 차이 줄(참고) */
async function compareDigests(log, label, a, b, pageA, pageB) {
  const failures = []
  if (a.random !== b.random) failures.push(`난수 칸 ${a.random} ≠ ${b.random}`)
  if (a.appTick !== b.appTick) failures.push(`앱 틱 ${a.appTick} ≠ ${b.appTick}`)
  for (const key of new Set([...Object.keys(a.core), ...Object.keys(b.core)])) {
    if (a.core[key] === b.core[key]) continue
    failures.push(`${key}: ${firstDiffs(JSON.parse(a.core[key] ?? 'null'), JSON.parse(b.core[key] ?? 'null')).join(' · ')}`)
  }
  for (const key of new Set([...Object.keys(a.storage), ...Object.keys(b.storage)])) {
    if (a.storage[key] !== b.storage[key]) failures.push(`저장 ${key} 다름`)
  }
  const msNotes = []
  for (const key of new Set([...Object.keys(a.modules), ...Object.keys(b.modules)])) {
    if (a.modules[key] === b.modules[key]) continue
    const diffs = firstDiffs(JSON.parse(a.modules[key] ?? 'null'), JSON.parse(b.modules[key] ?? 'null'), '', [], 20)
    // 실제 시각(ms) 칸만 다르면 참고 — 가짜 시계의 그림 틀(rAF, 16ms 격자) 위상이 쪽마다 달라 틱 안 몇 ms 가 갈린다(틱 · 난수 · 화면은 같다)
    if (key.startsWith('playClock#') || diffs.every((line) => MS_FIELD.test(line))) msNotes.push(`모듈 ${key}: ${diffs.slice(0, 3).join(' · ')}`)
    else failures.push(`모듈 ${key}: ${diffs.slice(0, 6).join(' · ')}`)
  }
  const fiberDiffs = [...new Set([...Object.keys(a.fibers), ...Object.keys(b.fibers)])].filter((path) => a.fibers[path] !== b.fibers[path])
  const notes = []
  for (const path of fiberDiffs.slice(0, 4)) {
    const [valuesA, valuesB] = await Promise.all([pageA, pageB].map((page) => page.evaluate((at) => window.__snapshot.fiberValuesAt(at), path)))
    const name = await pageA.evaluate((at) => window.__snapshot.fiberNameAt(at), path)
    notes.push(
      `  · ${name ?? '?'} ${path.split('/').slice(-3).join('/')} (${a.fibers[path] === undefined ? 'A 에 없음' : b.fibers[path] === undefined ? 'B 에 없음' : '다름'}): ${firstDiffs(valuesA, valuesB, '', [], 3).join(' · ')}`,
    )
  }
  log(
    `  ${failures.length === 0 ? 'ok  ' : 'DIFF'} ${label} — 앱 틱 ${a.appTick}/${b.appTick} · 난수 ${a.random}/${b.random} · 핵심 다름 ${failures.length} · 부품 자리 다름 ${fiberDiffs.length}/${Object.keys(a.fibers).length}`,
  )
  for (const line of failures.slice(0, 8)) log(`    ✗ ${line}`)
  for (const line of msNotes) log(`    · ms 칸(참고) ${line}`)
  if (fiberDiffs.length > 0) for (const line of notes) log(`  ${line}`)
  return { failures, fiberDiffs: fiberDiffs.length }
}

/** 두 PNG 의 다른 픽셀 수와 그 테두리 상자(화면 판 픽셀) */
async function diffPixels(helper, a, b) {
  if (Buffer.compare(a, b) === 0) return { count: 0, box: null }
  return helper.evaluate(
    async ([left, right]) => {
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
      if (x.width !== y.width || x.height !== y.height) return { count: -1, box: null }
      let count = 0
      const box = { left: Infinity, top: Infinity, right: -1, bottom: -1 }
      for (let at = 0; at < x.data.length; at += 4) {
        if (x.data[at] !== y.data[at] || x.data[at + 1] !== y.data[at + 1] || x.data[at + 2] !== y.data[at + 2]) {
          count += 1
          const pixel = at / 4
          const px = pixel % x.width
          const py = Math.floor(pixel / x.width)
          box.left = Math.min(box.left, px)
          box.top = Math.min(box.top, py)
          box.right = Math.max(box.right, px)
          box.bottom = Math.max(box.bottom, py)
        }
      }
      return { count, box: count === 0 ? null : box }
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

async function verifyScene(log, browser, helper, browserName, device, base, scene) {
  const label = `${browserName}-${device}-${scene}`
  let ok = true
  const a = await openPage(browser, device)
  let b = null
  try {
    // A — 실제로 진행해 닿은 순간을 그 자리에서 뜬다
    await a.page.goto(`${base}?scene=${scene}&real=1&capture=1`, { waitUntil: 'commit' })
    const virtualA = await driveToReady(a.page, a.stats)
    const snapshot = await a.page.evaluate(() => window.__capturedSnapshot)
    // 파일이 지금 뜬 것과 같은가 — 다르면 낡은 파일 (값만)
    const filePath = join(SNAPSHOT_DIR, `${scene}.json.gz`)
    // 파일은 chromium 데스크톱에서 뜬다 — 다른 브라우저 · 기기는 실제 진행이 한 틱 갈릴 수 있어(그림 틀 위상) 참고로만 본다
    const isCaptureRun = browserName === 'chromium' && device === 'desktop'
    if (existsSync(filePath) && !isCaptureRun) {
      const file = JSON.parse(gunzipSync(readFileSync(filePath)).toString('utf8'))
      log(
        `  참고 파일(chromium 데스크톱에서 뜸) vs 이 기기에서 뜬 것 — 앱 틱 ${file.appTick}/${snapshot.appTick} · 난수 ${file.random}/${snapshot.random}`,
      )
    } else if (existsSync(filePath)) {
      const file = JSON.parse(gunzipSync(readFileSync(filePath)).toString('utf8'))
      const same =
        file.random === snapshot.random && file.appTick === snapshot.appTick && JSON.stringify(file.values) === JSON.stringify(snapshot.values)
      log(
        `  ${same ? 'ok  ' : '낡음'} 파일 vs 지금 뜬 것 — 앱 틱 ${file.appTick}/${snapshot.appTick} · 난수 ${file.random}/${snapshot.random}${same ? '' : ' (pnpm e2e:snapshot 으로 다시 뜰 것)'}`,
      )
    } else {
      log(`  없음 파일 ${filePath}`)
    }
    // B — 그 스냅샷을 넣고 바로 연다
    b = await openPage(browser, device, { inject: snapshot })
    const openedB = Date.now()
    await b.page.goto(`${base}?scene=${scene}&snapshot=inject`, { waitUntil: 'commit' })
    const virtualB = await driveToReady(b.page, b.stats)
    const restore = await b.page.evaluate(() => window.__scene?.restore ?? null)
    log(
      `  A 실제 진행 가상 ${(virtualA / 1000).toFixed(1)}s · B 되살리기 가상 ${(virtualB / 1000).toFixed(1)}s(실제 ${((Date.now() - openedB) / 1000).toFixed(1)}s) · 바퀴 ${restore?.passes} · 자리 ${restore?.restored}/${restore?.fibers}${restore?.missing?.length ? ` · 안 선 자리 ${restore.missing.length}: ${restore.missing.slice(0, 3).join(' | ')}` : ''}`,
    )
    // 같은 틱에 맞춘다
    let tick = Math.max(await tickOf(a.page), await tickOf(b.page)) + 2
    const check = async (stepLabel) => {
      await alignAtTick([a, b], tick)
      const [digestA, digestB] = await Promise.all([digestOf(a.page), digestOf(b.page)])
      const compared = await compareDigests(log, stepLabel, digestA, digestB, a.page, b.page)
      const [shotA, shotB] = await Promise.all([
        shotOf(a.page, join(OUT, `${label}-${stepLabel}-a.png`)),
        shotOf(b.page, join(OUT, `${label}-${stepLabel}-b.png`)),
      ])
      const { count: pixels, box } = await diffPixels(helper, shotA, shotB)
      log(
        `  ${pixels === 0 ? 'ok  ' : 'DIFF'} ${stepLabel} 화면 — 다른 픽셀 ${pixels}${box === null ? '' : ` (상자 ${box.left},${box.top}–${box.right},${box.bottom})`}`,
      )
      if (compared.failures.length > 0 || pixels !== 0) ok = false
    }
    await check('바로 연 순간')
    for (const [index, step] of (FOLLOW[scene] ?? []).entries()) {
      await Promise.all(
        [a.page, b.page].map(async (page) => {
          await page.keyboard.down(step.key)
          await page.keyboard.up(step.key)
        }),
      )
      tick += step.ticks
      await check(`걸음 ${index + 1} ${step.key}+${step.ticks}틱`)
    }
    for (const side of [a, b])
      if (side.stats.pageErrors.length > 0) {
        ok = false
        log(`    ✗ pageerror: ${side.stats.pageErrors[0]}`)
      }
  } catch (error) {
    ok = false
    log(`    ✗ ${String(error.message ?? error).slice(0, 400)}`)
  } finally {
    await a.context.close().catch(() => {})
    if (b !== null) await b.context.close().catch(() => {})
  }
  return ok
}

// ─── 실행 ───

const args = process.argv.slice(2)
const isVerify = args[0] === 'verify'
const asked = isVerify ? args.slice(1) : args
const known = snapshotScenes()
const scenes = asked.length > 0 ? asked : known
for (const scene of scenes) if (!known.includes(scene)) throw new Error(`장면 표에 snapshot 이 없는 장면: ${scene} (있는 것: ${known.join(', ')})`)

const started = Date.now()
const server =
  process.env.E2E_SNAPSHOT_URL === undefined
    ? await startE2ePreview({ port: PORT, dir: 'dist-snapshot' })
    : { url: process.env.E2E_SNAPSHOT_URL, stop: () => {}, buildMs: 0 }
let failed = false
try {
  if (!isVerify) {
    const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable() })
    try {
      // 하나씩 — 맥락 하나로 (가짜 시계로 실제 진행해 CPU 를 오래 쓴다, r342)
      for (const scene of scenes) {
        try {
          await captureScene(browser, server.url, scene)
        } catch (error) {
          failed = true
          console.log(`FAIL ${scene}: ${String(error?.message ?? error).slice(0, 400)}`)
        }
      }
    } finally {
      await browser.close()
    }
    if (!failed) console.log('뜬 파일은 다음 e2e 빌드에 실린다 (`e2e:quick` · `e2e:only` 는 스냅샷이 바뀌면 다시 묶는다)')
  } else {
    const runs = (process.env.E2E_SNAPSHOT_RUNS ?? 'chromium:desktop,webkit:iphone').split(',').map((pair) => pair.split(':'))
    // 브라우저는 하나씩 (맥락 셋: 실제 진행 · 되살리기 · 픽셀 견주기, r342)
    for (const [browserName, device] of runs) {
      const type = browserName === 'webkit' ? webkit : chromium
      const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
      const browser = await type.launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
      const helper = await (await browser.newContext()).newPage()
      try {
        for (const scene of scenes) {
          const lines = []
          const ok = await verifyScene((line) => lines.push(line), browser, helper, browserName, device, server.url, scene)
          console.log(`${ok ? 'ok  ' : 'FAIL'} ${browserName}:${device} ${scene}\n${lines.join('\n')}`)
          if (!ok) failed = true
        }
      } finally {
        await browser.close()
      }
    }
  }
} finally {
  server.stop()
}
console.log(`${failed ? '실패' : '통과'} · ${((Date.now() - started) / 1000).toFixed(1)}s (빌드 ${(server.buildMs / 1000).toFixed(1)}s)`)
process.exit(failed ? 1 : 0)
