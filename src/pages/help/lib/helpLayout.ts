import {
  DESCRIPTION_PANEL, FOOTER, HEADBAND, ROW, SCREEN, WHEEL,
  descriptionPanelTopOf, rowTopOf,
} from '@/pages/special/lib/specialLayout'

/**
 * 도움말 배치 — **큰 정정** (S12 2절).
 *
 * 앞서 "도움말 = 메인 메뉴 상태 9 목록 + 상태 37 본문" 이라고 옮긴 것은 **틀렸다**.
 *   - 상태 9 하위 목록의 설명 글은 `0x2584c adds r1, #0x18` → `StrMAINMENU[24 + 커서]`
 *     ("…의 순위를 확인합니다") 이므로 그 화면은 **랭킹 하위 메뉴**다. 상태 37 은 **랭킹 표**이고,
 *     표 `0xcedf4 = [9,12,15,18,20]` 은 그 화면의 img_text **제목 프레임**이다(StrHOWTO 와 무관).
 *   - **진짜 도움말은 상태 7** 이다 — 그리기 `0x2fc8c` = 판 `0x58371(skin, 메뉴, 0)` +
 *     StrHOWTO 뷰어 `0x639a5`(→ `0x58d10`) + 머리띠 `0x54d95(메뉴, 0, 5)`.
 *     뷰어는 `0x2668c` 가 `0x63689(뷰어, 0)` 로 **장 0** 부터 열고, 상태 10 [게임문의]만
 *     `0x63689(뷰어, 6)` + `[뷰어+0x45c] = 1`(장 이동 잠금)로 연다.
 *     경기 중 메뉴 [조작방법](`0x3c25a`)도 같은 뷰어를 **장 0**(기본 조작)으로 연다.
 *
 * 장 묶음은 `shared/config/helpSections.ts` 가 원본 표 `0xd0b18 = [5,5,7,6,3,6,4]` 그대로 담는다 —
 * **일곱 장**이라 기본 조작·미션모드·환경설정도 모두 이 화면에서 볼 수 있다
 * (앞서 "다섯 칸뿐이라 이 화면에 없다" 고 적어 둔 주석은 틀렸다).
 */

export { DESCRIPTION_PANEL, FOOTER, HEADBAND, ROW, SCREEN, WHEEL, descriptionPanelTopOf, rowTopOf }

/**
 * ⚠️ 아래 다섯 칸은 **도움말이 아니라 랭킹 하위 메뉴(상태 9)** 의 것이다 (표 `0xceb37` =
 * main_ui 프레임 7 일반모드 · 8 나만의리그 · 9 시즌모드 · 10 대전모드 · 13 홈런더비).
 * 설명 글은 `StrMAINMENU[24 + 커서]` 다. 랭킹 화면을 옮길 때 이 값을 그대로 가져가면 된다 —
 * 도움말 화면(상태 7)은 이 목록을 쓰지 않는다.
 */
export interface RankingMenuItem {
  readonly id: string
  /** main_ui 프레임 번호 (표 0xceb37) */
  readonly labelFrame: number
  /** 프레임 그림 크기 — PNG 머리에서 읽은 실제 값 (origins.json 은 다 (0,0) 원점이다) */
  readonly labelWidth: number
  readonly labelHeight: number
  /** 설명 글 원문 — StrMAINMENU[24 + 커서] (S12 2-1 확정) */
  readonly description: string
}

export const RANKING_MENU_ITEMS: readonly RankingMenuItem[] = [
  {
    id: '일반모드', labelFrame: 7, labelWidth: 97, labelHeight: 27,
    description: '일반모드의!N순위를 확인합니다', // StrMAINMENU[24]
  },
  {
    id: '나만의리그', labelFrame: 8, labelWidth: 115, labelHeight: 27,
    description: '나만의 리그의!N순위를 확인합니다', // [25]
  },
  {
    id: '시즌모드', labelFrame: 9, labelWidth: 98, labelHeight: 27,
    description: '시즌모드의!N순위를 확인합니다', // [26]
  },
  {
    id: '대전모드', labelFrame: 10, labelWidth: 96, labelHeight: 27,
    description: '대전모드의!N순위를 확인합니다', // [27]
  },
  {
    id: '홈런더비', labelFrame: 13, labelWidth: 95, labelHeight: 27,
    // 원본 글은 "훈련모드의…" 다 (칸은 홈런더비인데 글이 어긋난 것 — 원본 그대로 옮긴다)
    description: '훈련모드의!N순위를 확인합니다', // [28]
  },
]

/** 랭킹 표 화면(상태 37)의 제목 그림 — 표 `0xcedf4` = img_text 프레임 (S12 2-1) */
export const RANKING_TITLE_FRAMES = [9, 12, 15, 18, 20] as const

/** 항목 그림 왼쪽 끝 — 가운데 x = W − 39 − w/2 이므로 오른쪽 끝이 201 에 붙는다 (0x253d4) */
export const rowLeftOf = (item: RankingMenuItem) => ROW.rightEdge - item.labelWidth

/**
 * 도움말 본문 판 (상태 7 · 경기 중 [조작방법] — 뷰어 그리기 `0x58fd4`).
 * 판 0x55e60 은 가운데 (W/2, H/2) · 폭 192 · 다 열린 높이 0xd4 = 212 라 왼쪽 위가 (24, 54) 다 (확정).
 * 쪽 번호 자리는 `HELP_VIEWER` 표 참고 — 숫자 그림(num.pzx 0x585ac)은 웹 글자로 둔다(근사).
 */
export const BODY_PANEL = {
  x: SCREEN.width / 2 - 96,
  y: SCREEN.height / 2 - 106,
  width: 192,
  height: 212,
  /** 쪽 번호 — 쪽 (W/2 + 0x34, y0 + 0x16) · 쪽수 (W/2 + 0x42, …). 웹은 "쪽/쪽수" 한 덩이로 쪽 자리에 쓴다 */
  pager: {
    numberX: SCREEN.width / 2 + 0x34,
    y: 54 + 0x16,
  },
} as const

/**
 * 뷰어 그리기 `0x58fd4`(→ 0x639a5 · 0x58d10) 의 배치 — x0 = W/2 − 0x60 = 24, y0 = H/2 − 0x6a = 54 (확정).
 *
 * | 그림 | 자리 |
 * |---|---|
 * | 판 0x55e60 | 가운데 (W/2, H/2), 폭 192, 높이 = 뷰어 +0x90 (여닫기 연출) |
 * | 장 띠 slt_frame **프레임** `[55..60][장]` (192×19) | (W/2 − 96, y0 − 2) = (24, 52) |
 * | 장 이름 img_text **프레임** `[8,9,12,15,18,25,26][장]` | 띠 프레임의 상자 r 안 가운데: (24 + r.x + (r.w − w)/2, y0 + r.y + 2) |
 * | 장 테두리 slt_frame **프레임 61** (72×17) | (24 + r.x, y0 + r.y − 2) — 쪽 보기면 늘, 장 고르기면 깜빡임 |
 * | 잠김(장 6) 제목 img_text 프레임 26 | (x0 + 0x21 − w/2, H/2 − 0x65) |
 * | 쪽 화살 slt_frame **이미지 20** | (W/2 + 0x23, y0 + 0x17) · 좌우 뒤집어 (W/2 + 0x50, …) — 장 고르기면 늘, 쪽 보기면 깜빡임 |
 * | 쪽 번호 0x585ac(num) | 쪽 (W/2 + 0x34, y0 + 0x16) · 쪽수 (W/2 + 0x42, …) · 사이 num 이미지 0x65 (W/2 + 0x36, …) |
 * | 본문 상자 0xbb28d | (x0 + 5, y0 + 0x24, 0xac, 0xab) |
 * | 스크롤 막대 0x58c10 | (x0 + 0xb3, y0 + 0x28) — `HELP_SCROLL_BAR` |
 * | 글 0x58750 | `HELP_TEXT_BOX` |
 *
 * 깜빡임: 그릴 때마다 +0x410 을 1 올리고 `% 8 ≤ 3` 이면 켠다(0x58d1e). 판이 여닫히는 동안(+0x90 ≤ 0xd3)은 끈다(0x58efc).
 * 띠 프레임의 상자 r 은 slt_frame/frames/boxes.json 의 값이다(0x94a64 가 프레임 상자를 읽는다).
 */
export const HELP_VIEWER = {
  x0: 24,
  y0: 54,
  panelWidth: 192,
  centerY: SCREEN.height / 2,
  /** 장 띠 slt_frame 프레임 55~60 — 장 0~5 */
  tab: { firstFrame: 55, x: 24, y: 52 },
  /** 띠 프레임 55~60 의 상자 (x, y, w, h) — boxes.json */
  tabBoxes: [
    [2, 2, 72, 17],
    [25, 2, 72, 17],
    [48, 2, 72, 17],
    [71, 2, 72, 17],
    [94, 2, 72, 17],
    [118, 2, 72, 17],
  ],
  /** 장 이름 img_text 프레임 (표 0xd1ad0) 과 그 폭 (img_text/frames/origins.json) */
  names: [
    { frame: 8, width: 43 },
    { frame: 9, width: 42 },
    { frame: 12, width: 54 },
    { frame: 15, width: 42 },
    { frame: 18, width: 43 },
    { frame: 25, width: 42 },
    { frame: 26, width: 41 },
  ],
  highlightFrame: 61,
  lockedTitle: { frame: 26, width: 41, x: 24 + 0x21, y: SCREEN.height / 2 - 0x65 },
  pageArrow: { image: 20, leftX: SCREEN.width / 2 + 0x23, rightX: SCREEN.width / 2 + 0x50, y: 54 + 0x17 },
  innerBox: { x: 29, y: 90, width: 0xac, height: 0xab },
  /** 스크롤 막대 끝 화살 — slt_frame 이미지 78 (7×5): 위 (x, y − 4) · 아래는 뒤집어 (x, y + 159 + 1) */
  scrollCap: { image: 78 },
} as const

/**
 * 판 높이 연출 (+0x90 · 걸음 +0x94 · 끝 +0x98 · 방향 +0x99) — 그리기 끝 0x59300~0x593a8.
 * ```
 * 여는 중(+0x99 = 1):  걸음 ×= 4 · 높이 += 걸음 · ≥ 0xd4 면 0xd4 · 끝 = 1      (열 때 높이 0x20 · 걸음 1 — 0x63734)
 * 닫는 중(+0x99 = 0):  걸음 ×= 4 · 높이 −= 걸음 · ≤ 10 이면 10 · 끝 = 1          (CLR 이 걸음 1 · 끝 0 · 방향 0 — 0x6385c)
 * ```
 * 그린 높이는 열 때 32 → 36 → 52 → 116 → 212, 닫을 때 212 → 208 → 192 → 128 이고, 닫기 끝(+0x98)이 선 다음 갱신에
 * 키 0x637d0 이 1 을 돌려줘 뷰어가 닫힌다(0x63964). 단 `[뷰어+0x125]` 가 서 있으면 CLR 이 연출 없이 곧장 1 을 돌려준다
 * (0x63850) — 경기 장면 0x3301c 가 1, 메인 메뉴 0x234d4 · 경기 끝 0x332b8 가 0 으로 둔다. 그래서 **경기 중 [조작방법]은 곧장 닫힌다**.
 */
export const HELP_PANEL_OPEN_HEIGHTS: readonly number[] = [32, 36, 52, 116]
export const HELP_PANEL_CLOSE_HEIGHTS: readonly number[] = [212, 208, 192, 128]
export const HELP_PANEL_FULL_HEIGHT = 0xd4
