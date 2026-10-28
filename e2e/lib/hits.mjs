// 누름 칸 맞음 검사 — 화면의 누를 수 있는 요소마다 가운데 · 네 모서리 안쪽 점의 `elementFromPoint` 가 그 요소(또는 자손)인가.
//
//   import { scanHits } from './lib/hits.mjs'
//   const report = await scanHits(page)   // { checked, covered: [...], underWindow: [...] }
//
// r195 · r203 · r207 · r212 — 창 단추 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹혔다.

import { AREA_ALLOWED } from './catalog.mjs'

export { scanHits } from './hits-scan.mjs'

const CORNERS_ONLY = (row) => !row.points.includes('가운데')

/**
 * **허용 목록** — 의도된 겹침. `match(장면, 줄)` 이 참이면 실패로 치지 않고 따로 센다. 새로 넣을 때는 `why` 에 이유를 꼭 적는다.
 * 여러 도메인에 걸친 것만 여기 두고, 한 도메인 것은 그 도메인 파일(`e2e/areas/<도메인>.mjs` 의 `allowed`)에 둔다.
 * 줄의 칸: `label` · `by`(덮은 것) · `byPath`(덮은 것과 조상의 모듈 클래스) · `points`(못 맞은 점) · `full`(판 전체 칸인가)
 */
export const ALLOWED_OVERLAPS = [
  {
    match: (_scene, row) => row.full && CORNERS_ONLY(row) && /"(메뉴|닫기|# 대타|# 교체|# 취소)"$/.test(row.by),
    why: '판 전체 OK 칸(0xe 확인) 위 바닥띠 소프트키 글자 칸(*MENU · #TIME) — 원본도 \'*\' · \'#\' 는 OK 와 다른 키다. 판 가운데는 OK',
  },
  {
    match: (_scene, row) => CORNERS_ONLY(row) && row.by === row.label.replace(/"$/, ' (OK 글자)"'),
    why: '구질 고리 칸 0 과 고리 귀의 "OK" 글자 칸(r219) — 같은 칸 0 의 같은 onPress 라 모서리가 겹쳐도 같은 구질이 골린다',
  },
]

export function isAllowed(scene, row) {
  return ALLOWED_OVERLAPS.find((rule) => rule.match(scene, row)) ?? AREA_ALLOWED.find((rule) => rule.match(scene, row))
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
