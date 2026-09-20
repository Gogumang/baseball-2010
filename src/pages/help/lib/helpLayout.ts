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
 * 도움말 본문 창 (상태 7, 그리기 `0x2fc8c` → 뷰어 `0x639a5` → `0x58d10`).
 *
 * ⚠️ 판 `0x58371` 의 치수와 뷰어 `0x58d10` 의 쪽 나누기·글 배치는 **아직 미해독**이다.
 * 환경설정·기록연감과 같은 가운데 192 판(x0 = W/2 − 96 = 24, y0 = H/2 − 106 = 54)으로 두고
 * 쪽 제목 줄은 기록연감 자리를 쓴다 — **배치 근사**.
 */
export const BODY_PANEL = {
  x: SCREEN.width / 2 - 96,
  y: SCREEN.height / 2 - 106,
  width: 192,
  height: 212,
  /** 쪽 제목 줄 — 노란 네모 slt_frame 이미지 38 (34, 78) + 제목 (42, 76) */
  bullet: { image: 38, x: 34, y: 78 },
  titleX: 42,
  titleY: 76,
  /** 본문 글 — 판 안쪽 좌우 여백 10px, 제목 줄 아래 */
  textX: 34,
  textY: 94,
  textWidth: 172,
  /** 쪽 넘기기 화살 slt_frame 이미지 20 · 쪽 번호 (기록연감 PAGER 와 같은 자리) */
  pager: {
    arrowImage: 20,
    leftX: SCREEN.width / 2 + 35,
    rightX: SCREEN.width / 2 + 79,
    arrowY: 77,
    numberX: SCREEN.width / 2 + 52,
    y: 76,
  },
} as const
