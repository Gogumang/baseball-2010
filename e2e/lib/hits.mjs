// 누름 칸 맞음 검사 — 화면의 누를 수 있는 요소마다 가운데 · 네 모서리 안쪽 점의 `elementFromPoint` 가 그 요소(또는 자손)인가.
//
//   import { scanHits } from './lib/hits.mjs'
//   const report = await scanHits(page)   // { checked, covered: [...], underWindow: [...] }
//
// r195 · r203 · r207 · r212 — 창 단추 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹혔다.

/**
 * 쪽 안에서 도는 검사 (page.evaluate 로 보낸다 — 바깥 변수를 못 쓴다).
 * - 누를 수 있는 것: `button` · `[role=button]` · `[role=option]` · `[role=menuitem]` · `[data-touch-key]` (PressArea 는 button 이다)
 * - 꺼진 것(disabled · aria-disabled) · 안 보이는 것(크기 0 · visibility · display · 화면 밖 · inert) · pointer-events none 은 뺀다
 * - 덮은 것이 열린 창(`[role=dialog]`) 안이고 덮인 것이 그 창 밖이면 "창 아래" — 창이 키를 가져가는 원본대로라 실패가 아니다
 */
function scanInPage() {
  const SELECTOR = 'button, [role="button"], [role="option"], [role="menuitem"], [data-touch-key]'
  const labelOf = (element) => {
    if (element === null) return '(없음)'
    const tag = element.tagName.toLowerCase()
    const role = element.getAttribute('role')
    const interactive = element.matches(SELECTOR) || role === 'dialog'
    const text = interactive ? element.textContent?.trim().slice(0, 16) ?? '' : ''
    const own = element.getAttribute('aria-label') ?? element.getAttribute('data-testid') ?? text
    // 누를 수 없는 덮개는 글 대신 모듈 이름(vanilla-extract 클래스 머리 `Screen_part__hash` → `Screen_part`)
    const cls = typeof element.className === 'string' && element.className !== '' ? element.className.split(' ')[0].replace(/__[a-z0-9]+$/, '') : ''
    return `${tag}${role === null ? '' : `[${role}]`}${interactive || cls === '' ? '' : `.${cls}`}${own === '' ? '' : ` "${own}"`}`
  }
  /**
   * 웹킷은 CSS `zoom` 안 요소의 `getBoundingClientRect` 를 zoom 을 뺀 좌표로 낸다(크로미움 128+ 은 화면 좌표). `elementFromPoint` 는
   * 화면 좌표라, 웹킷이면 조상 zoom 곱을 곱해 화면 좌표로 옮긴다. 어느 쪽인지는 zoom 걸린 판의 자식 크기로 가린다.
   */
  const zoomOf = (element) => {
    let product = 1
    for (let node = element; node !== null; node = node.parentElement) product *= Number(getComputedStyle(node).zoom) || 1
    return product
  }
  const legacyZoom = (() => {
    const stage = document.querySelector('[data-original-screen]')
    if (stage === null || zoomOf(stage) === 1 || stage.offsetWidth === 0) return false
    return Math.abs(stage.getBoundingClientRect().width - stage.offsetWidth) < 0.5
  })()
  const viewportRectOf = (element) => {
    const rect = element.getBoundingClientRect()
    if (!legacyZoom) return rect
    const zoom = zoomOf(element)
    return { left: rect.left * zoom, top: rect.top * zoom, right: rect.right * zoom, bottom: rect.bottom * zoom, width: rect.width * zoom, height: rect.height * zoom }
  }
  /** 조상의 overflow 가 자른 뒤 보이는 사각형 (화면 좌표) */
  const clippedRectOf = (element) => {
    const rect = viewportRectOf(element)
    let left = Math.max(rect.left, 0)
    let top = Math.max(rect.top, 0)
    let right = Math.min(rect.right, window.innerWidth)
    let bottom = Math.min(rect.bottom, window.innerHeight)
    for (let node = element.parentElement; node !== null && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
      const clip = viewportRectOf(node)
      if (style.overflowX !== 'visible') {
        left = Math.max(left, clip.left)
        right = Math.min(right, clip.right)
      }
      if (style.overflowY !== 'visible') {
        top = Math.max(top, clip.top)
        bottom = Math.min(bottom, clip.bottom)
      }
    }
    return { rect, left, top, right, bottom }
  }
  /** 요소부터 위로 z-index 가 정해진 겹 — "9 < 7" 같은 비교를 읽게 */
  const zChainOf = (element) => {
    const chain = []
    for (let node = element; node !== null && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.zIndex !== 'auto' && style.position !== 'static') chain.push(Number(style.zIndex))
    }
    return chain.length === 0 ? 'auto' : chain.join('←')
  }
  /** 요소와 조상들의 모듈 클래스 이름(판까지) — 허용 목록이 "말풍선 안" 같은 것을 가린다 */
  const pathOf = (element) => {
    const names = []
    for (let node = element; node !== null && !node.hasAttribute?.('data-original-screen') && node !== document.body; node = node.parentElement) {
      if (typeof node.className === 'string' && node.className !== '') names.push(node.className.split(' ')[0].replace(/__[a-z0-9]+$/, ''))
    }
    return names.join(' < ')
  }
  /** 덮은 것의 이름 — 누를 수 있는 조상이 있으면 그것, 없으면 그 요소 */
  const ownerOf = (element) => element?.closest(SELECTOR) ?? element
  const windowOf = (element) => element?.closest('[role="dialog"]') ?? null
  const isShown = (element) => {
    if (element.closest('[inert], [aria-hidden="true"]') !== null) return false
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ visibilityProperty: true })) return false
    const style = getComputedStyle(element)
    if (style.visibility === 'hidden' || style.display === 'none') return false
    return true
  }
  const isEnabled = (element) => !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true'

  const stageElement = document.querySelector('[data-original-screen]')
  const stageRect = stageElement === null ? null : viewportRectOf(stageElement)
  const covered = []
  const underWindow = []
  let checked = 0
  const seen = new Set()
  for (const element of document.querySelectorAll(SELECTOR)) {
    // 누를 수 있는 것 안의 누를 수 있는 것(버튼 안 [role=option] 따위)은 바깥 것으로 센다
    const outer = element.parentElement?.closest(SELECTOR)
    if (outer !== null && outer !== undefined) continue
    if (seen.has(element)) continue
    seen.add(element)
    if (!isEnabled(element) || !isShown(element)) continue
    if (getComputedStyle(element).pointerEvents === 'none') continue
    // 화면 안 · 조상이 자르지 않은 몫만
    const { rect, left, top, right, bottom } = clippedRectOf(element)
    if (right - left < 1 || bottom - top < 1) continue
    checked++
    // 모서리 점은 안쪽으로 — 둥근 모서리(border-radius)는 칠한 곳만 맞는다
    const insetX = Math.min(8, (right - left) / 4)
    const insetY = Math.min(8, (bottom - top) / 4)
    const points = [
      ['가운데', (left + right) / 2, (top + bottom) / 2],
      ['왼위', left + insetX, top + insetY],
      ['오위', right - insetX, top + insetY],
      ['왼아래', left + insetX, bottom - insetY],
      ['오아래', right - insetX, bottom - insetY],
    ]
    const misses = new Map()
    for (const [name, x, y] of points) {
      const hit = document.elementFromPoint(x, y)
      if (hit !== null && (hit === element || element.contains(hit))) continue
      const owner = ownerOf(hit)
      const key = owner
      const entry = misses.get(key) ?? { owner, hit, points: [] }
      entry.points.push(name)
      misses.set(key, entry)
    }
    for (const { owner, hit, points: missed } of misses.values()) {
      const coverWindow = windowOf(owner)
      const ownWindow = windowOf(element)
      const row = {
        label: labelOf(element),
        z: zChainOf(element),
        window: ownWindow === null ? null : labelOf(ownWindow),
        by: labelOf(owner),
        byHit: hit === owner ? null : labelOf(hit),
        byZ: zChainOf(owner),
        byPath: pathOf(owner),
        full: stageRect !== null && Math.abs(left - stageRect.left) < 1 && Math.abs(top - stageRect.top) < 1
          && Math.abs(right - stageRect.right) < 1 && Math.abs(bottom - stageRect.bottom) < 1,
        byDisabled: owner !== null && owner.matches?.(':disabled') === true,
        byWindow: coverWindow === null ? null : labelOf(coverWindow),
        points: missed,
        rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
      }
      // 덮은 것이 열린 창 안이고 덮인 것은 그 창 밖 — 창 아래 깔린 화면 칸(원본도 창이 키를 가져간다)
      if (coverWindow !== null && !coverWindow.contains(element)) underWindow.push(row)
      else covered.push(row)
    }
  }
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(isShown).map(labelOf)
  return { checked, covered, underWindow, dialogs }
}

export async function scanHits(page) {
  return page.evaluate(scanInPage)
}

const PLACES = /"(경기장|번화가|병원|학교|방송국)"$/
const CORNERS_ONLY = (row) => !row.points.includes('가운데')

/**
 * **허용 목록** — 의도된 겹침. `match(장면, 줄)` 이 참이면 실패로 치지 않고 따로 센다. 새로 넣을 때는 `why` 에 이유를 꼭 적는다.
 * 줄의 칸: `label` · `by`(덮은 것) · `byPath`(덮은 것과 조상의 모듈 클래스) · `points`(못 맞은 점) · `full`(판 전체 칸인가)
 */
export const ALLOWED_OVERLAPS = [
  {
    match: (scene, row) => /outing$/.test(scene) && PLACES.test(row.label) && PLACES.test(row.by) && CORNERS_ONLY(row),
    why: '외출 지도 건물 칸은 건물 그림 사각형이라 이웃 건물과 모서리가 겹친다 — 고른 건물을 뒤에 그리는 원본 차례(0x7ec04) 그대로 위. 가운데는 제 건물',
  },
  {
    match: (scene, row) => /outing$/.test(scene) && PLACES.test(row.label) && /PlaceBubble_/.test(row.byPath),
    why: '외출 말풍선(PlaceBubble)이 떠 있는 동안 그 아래 건물 칸 — 키도 말풍선 것이고 CLR(취소 · 뒤로)로 닫는다',
  },
  {
    match: (_scene, row) => row.full && CORNERS_ONLY(row) && /"(메뉴|닫기|# 대타|# 교체|# 취소)"$/.test(row.by),
    why: '판 전체 OK 칸(0xe 확인) 위 바닥띠 소프트키 글자 칸(*MENU · #TIME) — 원본도 \'*\' · \'#\' 는 OK 와 다른 키다. 판 가운데는 OK',
  },
  {
    match: (scene, row) => scene === 'season-management' && row.label === 'button "되돌아가기"' && row.by === 'button "되돌아가기 칸"',
    why: '시즌 다음경기 0xd8 — 바닥띠 되돌아가기 그림 단추를 같은 자리 같은 일(onCancel)의 누름 칸이 덮는다. 판 전체 확인 칸(7) 위로 올리려고 둔 것(r186)',
  },
]

export function isAllowed(scene, row) {
  return ALLOWED_OVERLAPS.find((rule) => rule.match(scene, row))
}

/** 누를 수 있는 것들의 자리 지문 — 미끄러져 들어오는 연출(바닥띠 · 창)이 멈췄는지 본다 */
function layoutPrintInPage() {
  return [...document.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"], [data-touch-key], [role="dialog"]')]
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`
    })
    .join(';')
}

/** 지금 자리 지문 */
export async function layoutPrint(page) {
  return page.evaluate(layoutPrintInPage)
}

/** 자리가 `stableMs` 동안 그대로일 때까지 (길어도 `timeoutMs`) */
export async function waitLayoutStable(page, { stableMs = 400, timeoutMs = 4000, everyMs = 100 } = {}) {
  const started = Date.now()
  let last = await page.evaluate(layoutPrintInPage)
  let since = Date.now()
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(everyMs)
    const now = await page.evaluate(layoutPrintInPage)
    if (now !== last) {
      last = now
      since = Date.now()
    } else if (Date.now() - since >= stableMs) return true
  }
  return false
}
