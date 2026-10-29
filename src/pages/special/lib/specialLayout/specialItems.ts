import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

export const SCREEN = { width: 240, height: 320 } as const

/** 웹판에서 그 칸이 실제로 되는지 — 원본에 있는 칸은 못 써도 지우지 않고 흐리게 보여 준다 */
export type SpecialItemState = '됨' | '통신' | '아직'

export interface SpecialItem {
  readonly id: string
  /** main_ui 프레임 번호 (표 0xceb2f) */
  readonly labelFrame: number
  /** 프레임 그림 크기 — PNG 머리에서 읽은 실제 값 (origins.json 은 다 (0,0) 원점이다) */
  readonly labelWidth: number
  readonly labelHeight: number
  /** 원본 하위 상태 (표 0xceb88, P6 1-2 표) */
  readonly state: number
  /** 설명 글 StrMAINMENU[16 + 칸] 원문 (base/extracted/StrMAINMENU.json) */
  readonly description: string
  readonly availability: SpecialItemState
  /** 못 쓰는 칸을 눌렀을 때 띄우는 안내 (환경설정 "게임 데이터 관리" 와 같은 말투) */
  readonly blockedText?: string
}

/**
 * 여덟 칸 — 15 G포인트충전 · 16 G포인트선물 · 17 친구추천 · 18 명예의전당 ·
 * 19 마선수선택 · 20 에디트 · 21 기록연감 · 28 선물받기 (표 0xceb2f 확정).
 *
 * 항목 글자는 원본이 `#212B70`(RGB 33,43,112) 로 칠해 그리는데(프레임 그리기 색 인자),
 * 뽑아 둔 PNG 가 이미 그 남색이라 따로 칠하지 않는다.
 */
export const SPECIAL_ITEMS: readonly SpecialItem[] = [
  {
    id: 'G포인트 충전',
    labelFrame: 15,
    labelWidth: 124,
    labelHeight: 27,
    state: 24,
    description: ORIGINAL_MAIN_MENU_TEXT[16] ?? '', // [16]
    availability: '통신',
    blockedText: 'G포인트 충전은!N통신이 필요합니다',
  },
  {
    id: 'G포인트 선물',
    labelFrame: 16,
    labelWidth: 125,
    labelHeight: 27,
    state: 25,
    description: ORIGINAL_MAIN_MENU_TEXT[17] ?? '', // [17]
    availability: '통신',
    blockedText: 'G포인트 선물은!N통신이 필요합니다',
  },
  {
    id: '친구추천',
    labelFrame: 17,
    labelWidth: 97,
    labelHeight: 27,
    state: 26,
    description: ORIGINAL_MAIN_MENU_TEXT[18] ?? '', // [18]
    availability: '통신',
    blockedText: '친구추천은!N통신이 필요합니다',
  },
  {
    id: '명예의전당',
    labelFrame: 18,
    labelWidth: 115,
    labelHeight: 27,
    state: 27,
    description: ORIGINAL_MAIN_MENU_TEXT[19] ?? '', // [19]
    availability: '됨',
  },
  {
    id: '마선수선택',
    labelFrame: 19,
    labelWidth: 118,
    labelHeight: 27,
    state: 28,
    description: ORIGINAL_MAIN_MENU_TEXT[20] ?? '', // [20]
    // 상태 28 (그리기 0x2df78 · 갱신 0x2af20) — 화면은 앱이 `renderAceSelect` 로 꽂는다 (pages 끼리 import 금지)
    availability: '됨',
  },
  {
    id: '에디트',
    labelFrame: 20,
    labelWidth: 73,
    labelHeight: 27,
    state: 29,
    description: ORIGINAL_MAIN_MENU_TEXT[21] ?? '', // [21]
    // 상태 29 (진입 0x24804 · 갱신 0x2b2e0 · 그리기 0x2e1e0) — 화면은 앱이 `renderEdit` 으로 꽂는다 (pages 끼리 import 금지)
    availability: '됨',
  },
  {
    id: '기록연감',
    labelFrame: 21,
    labelWidth: 97,
    labelHeight: 27,
    state: 30,
    description: ORIGINAL_MAIN_MENU_TEXT[22] ?? '', // [22]
    availability: '됨',
  },
  {
    id: '선물받기',
    labelFrame: 28,
    labelWidth: 90,
    labelHeight: 25,
    state: 31,
    description: ORIGINAL_MAIN_MENU_TEXT[23] ?? '', // [23]
    availability: '통신',
    blockedText: '선물받기는!N통신이 필요합니다',
  },
]

export const ITEM_COUNT = SPECIAL_ITEMS.length

/**
 * **목록 = 메인 메뉴 아랫단과 같은 세로 릴 0x2524c(this, 6, 틱)** — 그리기 0x2860c 는 0x2863c(게임시작 5)와 목록 종류만 다르다
 * (0x2860c: `0x24b1c(this)` → `0x2524c(this, 6, [this+0x2c])` → `0x54d95(skin, 0, 5)`, 직접 떴다).
 * 그래서 줄 y · 바탕 띠 · 설명 판 · 회색 제목 · 설명 띠는 `pages/main-menu/lib/mainMenuLayout` 의 `MENU_REEL_*` ·
 * `MENU_BAND_*` · `MENU_DESCRIPTION_PANEL` 을 그대로 쓴다 (S9 7절):
 * ```
 * 줄 글자 = img_text 0xcea24 [7, 11, 189, 14, 17, 19, 21, 315] — 슬롯 표 0xceaf2[1] = [−1, 6, 7, 8, 1, 2, 3, 4, 5]
 * 슬롯 1·2·3 y = 320 + 20i − 100 − 7 (+ 스크롤) · 4 는 안 그림(판이 대신) · 5·6·7 은 320 + 20i − 60 (화면 밖)
 * 설명 판 main_ui 이미지 3 (96, 289) · 판 안 큰 글자 main_ui 프레임(칸) · 회색 제목 img_text 0xcea6c[1] = 1 "스페셜"
 * 설명 띠 0x55545(StrMAINMENU[0x10 + 커서]) — 바탕 띠가 자라는 동안은 줄 · 띠를 안 그린다(0x254d8)
 * ```
 * 판 안 큰 글자의 main_ui 프레임은 표 0xceb2f (`SPECIAL_ITEMS[].labelFrame`).
 */
export const SPECIAL_REEL_STATE = 6

/*
 * 설명 판 까딱임 — 판 그리기 0x25716~0x25752 가 판 자리에 더한다.
 *
 * 갱신 0x28b9c 가 ↑ · ↓ 에 [메뉴+0xf4] = 1 을 세우고 0x5550d 로 방향([skin+0x8c])을 적는다(0x28c56~0x28c8a).
 * 그리기 머리 0x252c6~0x252e8 이 [+0xf4] 면 t [메뉴+0xf8] = 0 · 방향 [메뉴+0xfc] = [skin+0x8c], 판 그리기가
 * [+0xfc] ≠ −1 이면 판 자리에 `0xce8bc[2·방향 + t]` · `0xce88c[3·방향 + t]` 를 더하고 t 를 올린다(t > 1 이면 −1).
 * 판 안 큰 글자 · 회색 제목도 판 자리에서 재므로 함께 까딱인다 — 표 값은 기록연감과 같다(`shared/lib/cursorShake`):
 * ↑ (0,−2)(0,+2) · ↓ (0,+2)(0,−2), 두 그리기.
 * 키는 [메뉴+0xe1] ≠ 0 이고 바탕 띠가 다 자랐을 때([메뉴+0xe2] == 0)만 받는다(0x28ba0~0x28bb4).
 */

/*
 * 반원 바퀴 (0x24b1c — F-5 확정)는 메인 메뉴의 `MenuWheel`(pages/main-menu/ui/MenuWheel.tsx)을 그대로 깐다 —
 * 중심 (120, 320), 테두리 원 3겹 반지름 93·95·97, 가운데에서 `main_ball` 애니 0 이 돈다.
 */
