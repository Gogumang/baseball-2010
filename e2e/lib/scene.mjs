// 화면 확인 공용 도우미 (Playwright). 서버는 `e2e/serve.sh` 로 한 번 띄워 둔다.
//
//   import { launchScene, openScene, tap, topElementAt, pressKey, shot } from './lib/scene.mjs'
//   const { browser, page } = await launchScene('webkit', 'nari-outing', { device: 'iphone' })
//   await openScene(page, 'season-outing')   // 같은 쪽에서 다른 장면
//   await tap(page, 220, 310)         // 원본 240×320 좌표
//   await shot(page, 'e2e/.run/a.png')
//
// 실행은 PnP 로: `yarn node e2e/<스크립트>.mjs`
import { chromium, devices, webkit } from 'playwright'
import { chromiumExecutable } from './browsers.mjs'

export const BASE_URL = process.env.E2E_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 5410}/`

/** 원본 화면 크기 */
export const SCREEN = { width: 240, height: 320 }

const SCREEN_SELECTOR = '[data-original-screen]'

/**
 * 기기 꼴. `iphone` 은 Playwright iPhone 13 (390×664 · 터치 · 모바일) — 웹킷으로 띄우면 아이폰 Safari 와 같은 엔진이다.
 * `desktop` 은 마우스 · 1000×800.
 */
export const DEVICES = {
  desktop: { viewport: { width: 1000, height: 800 } },
  iphone: (() => {
    const { defaultBrowserType: _ignored, ...descriptor } = devices['iPhone 13']
    return descriptor
  })(),
  'iphone-land': (() => {
    const { defaultBrowserType: _ignored, viewport, ...descriptor } = devices['iPhone 13']
    return { ...descriptor, viewport: { width: viewport.height, height: viewport.width } }
  })(),
}

/** 브라우저 · 맥락 · 쪽 하나. `browserName`: 'chromium' | 'webkit' */
export async function launch(browserName = 'chromium', { device = 'desktop', headless = true } = {}) {
  const type = browserName === 'webkit' ? webkit : chromium
  const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
  const browser = await type.launch({ headless, ...(executablePath === undefined ? {} : { executablePath }) })
  const context = await browser.newContext(DEVICES[device] ?? DEVICES.desktop)
  const page = await context.newPage()
  // 웹폰트 CDN(Galmuri) — 막혀 있어도 그림은 원본 글꼴(같은 서버)로 그린다. 기다리지 않게 끊는다
  await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort())
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return { browser, context, page, errors, device, browserName }
}

/**
 * 장면에 곧바로 들어간다 — `?scene=<장면>&fixture=<픽스처>` (개발 서버 · e2e 빌드만). 진행기가 `<html data-scene="ready">` 를
 * 적을 때까지 기다린다. `fixture` 를 안 주면 장면 표(`src/app/dev/scenes/<도메인>.ts`)의 기본 픽스처.
 */
export async function openScene(page, scene, { fixture, query = '', timeout = 20000 } = {}) {
  const params = new URLSearchParams()
  if (scene) params.set('scene', scene)
  if (fixture) params.set('fixture', fixture)
  const extra = query.replace(/^[?&]/, '')
  const url = `${BASE_URL}?${params}${extra === '' ? '' : `&${extra}`}`
  await page.goto(url)
  await page.waitForFunction(() => {
    const state = document.documentElement.dataset.scene
    return state === 'ready' || state === 'error'
  }, null, { timeout })
  const status = await page.evaluate(() => window.__scene)
  if (status?.status !== 'ready') throw new Error(`장면 ${scene} 실패: ${status?.error ?? '?'} (단계 ${status?.steps?.join(' → ')})`)
  return status
}

/** 브라우저를 띄우고 곧바로 장면까지 — `{ device: 'iphone' }` 이면 아이폰 13 꼴(웹킷이면 Safari 엔진) */
export async function launchScene(browserName, scene, { device = 'desktop', fixture, query } = {}) {
  const session = await launch(browserName, { device })
  session.status = await openScene(session.page, scene, { fixture, query })
  return session
}

/** 원본 화면 판의 화면 좌표 사각형 (zoom 적용 뒤) */
export async function screenRect(page) {
  const box = await page.locator(SCREEN_SELECTOR).first().boundingBox()
  if (box === null) throw new Error('원본 화면 판이 없다')
  return box
}

/** 원본 240×320 좌표 → 쪽 좌표 */
export async function toPagePoint(page, x, y) {
  const box = await screenRect(page)
  return { x: box.x + (x * box.width) / SCREEN.width, y: box.y + (y * box.height) / SCREEN.height }
}

/** 원본 좌표 탭 — 터치 기기면 touchscreen, 아니면 마우스 클릭 */
export async function tap(page, x, y) {
  const point = await toPagePoint(page, x, y)
  return tapPage(page, point.x, point.y)
}

/** 쪽 좌표 탭 (화면 판 밖 — 터치 버튼 따위) */
export async function tapPage(page, x, y) {
  const hasTouch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  if (hasTouch) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
}

/** 원본 좌표의 맨 위 요소 (elementsFromPoint 위 몇 겹) — 겹침 확인용 */
export async function topElementAt(page, x, y, depth = 4) {
  const point = await toPagePoint(page, x, y)
  return page.evaluate(({ px, py, n }) => {
    const nameOf = (element) => {
      const cls = typeof element.className === 'string' && element.className !== '' ? `.${element.className.split(' ')[0]}` : ''
      const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 12) ?? ''
      return `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`}${cls}${label === '' ? '' : ` "${label}"`}`
    }
    return document.elementsFromPoint(px, py).slice(0, n).map(nameOf)
  }, { px: point.x, py: point.y, n: depth })
}

/** 키 누르고 떼기 — 앱 키 문이 다음 앱 틱에 처리하므로 조금 기다린다 */
export async function pressKey(page, key, { times = 1, gap = 120 } = {}) {
  for (let count = 0; count < times; count++) {
    await page.keyboard.press(key, { delay: 40 })
    await page.waitForTimeout(gap)
  }
}

/** 지금 화면 상태 (App 이 내놓은 손잡이) */
export async function screenState(page) {
  return page.evaluate(() => window.__sceneProbe?.() ?? null)
}

/** 화면 판 스크린샷 — `full: true` 면 쪽 전체(터치 버튼 포함) */
export async function shot(page, path, { full = false } = {}) {
  if (full) return page.screenshot({ path })
  return page.locator(SCREEN_SELECTOR).first().screenshot({ path })
}

/** 지금 쪽의 저장을 픽스처 파일로 뜬다 — `fixture-dump.mjs` */
export { dumpFixture } from './fixture-dump.mjs'
