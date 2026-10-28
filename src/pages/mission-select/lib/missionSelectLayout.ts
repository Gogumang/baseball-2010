/**
 * 미션 선택 화면 배치 (장면 0x107 상태 1·2 그리기 0x1df08 — P6 2b 확정).
 *
 * ```
 * y0 = H/2 − 109 = 51
 * 창 = 공용 판 0x55e61(skin, W/2, H/2, 192, 212, 0, 0x22, 위 띠 0x10, 0, 0, 0) → (24, 54, 192, 212)  ; 1df84~1dfa4
 * 격자 = 0x79ed5([this+0x80], 5, 120, y0 + 28 = 79, 표, 칸 28, 5열, 3행) → 15칸
 * ```
 * 격자 만들기 인자의 `cy` 는 **중심이 아니라 첫 줄 위쪽 y** 다 (S9 확정 — P6 의 "중심" 표기는
 * 그때 인자 이름을 잘못 읽은 것). 왼쪽 x 는 `cx − (Σ칸너비 + (열−1)·가로틈)/2` 로 가운데를 맞춘다.
 */
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

const SCREEN_WIDTH = 240

export const PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** 미션 이름 — 판 윗부분 밝은 제목 띠 위, 글색 #335FCD */
export const TITLE = { x: 24, y: 51 + 7, width: 192, color: '#335FCD' } as const

/**
 * `0x79ed5([this+0x80], 5, 120, [sp+0x38] + 0x1c, 표 0xcd68c, 0x1c, 5, 3, 3, 2, 2)` (0x1e166~0x1e1a8, 직접 떴다):
 * 칸 너비 표 0xcd68c = [30, 30, 30, 30, 30] · 줄높이 28 · 가로틈 3 · 세로틈 2 · 가속 시프트 2.
 * 시작 `0x7a005(격자, 1, 1, 0)`(0x1e1ac~0x1e1b6) — 열림 애니가 늘 돈다. 격자는 [this+0xa1] 이 서 있을 때만 다시 짓고(0x1e15c~0x1e1e4)
 * 그 깃발은 상태 1 진입 0x1d9a4 만 세운다(0x1da08) → 상태 1 에 들어와 본문을 처음 그릴 때 한 번 돈다.
 */
export const GRID = {
  columns: 5,
  rows: 3,
  /** 줄높이 (칸 높이) */
  cell: 28,
  /** 칸 너비 — 표 0xcd68c */
  cellWidth: 30,
  hGap: 3,
  vGap: 2,
  centerX: SCREEN_WIDTH / 2,
  top: 51 + 28,
} as const

/** 격자 열림 애니의 꼴 (`shared/lib/gridOpen`) */
export const MISSION_GRID_OPEN: GridOpenShape = {
  rows: GRID.rows,
  columns: GRID.columns,
  rowHeight: GRID.cell,
  rowGap: GRID.vGap,
  shift: 2,
}

export const GRID_LEFT = GRID.centerX - Math.trunc((GRID.columns * GRID.cellWidth + (GRID.columns - 1) * GRID.hGap) / 2)

export function cellPositionOf(index: number) {
  const column = index % GRID.columns
  const row = Math.floor(index / GRID.columns)
  return {
    x: GRID_LEFT + column * (GRID.cellWidth + GRID.hGap),
    y: GRID.top + row * (GRID.cell + GRID.vGap),
  }
}

/** 아래 틀 — slt_frame 프레임 1 (169×78: 꼬리 탭 + 점 5개 + 버튼 두 개) */
export const BOTTOM_FRAME = { frame: 1, x: 34, y: 175 } as const
/**
 * 아래 줄 기준 x — `0xba815([this+0x78] = slt_frame, 프레임 1, 종류 1)`(0x1dfb4~0x1dfc4) 가 잰 **아래 틀 프레임 1 의 폭 169** 로
 * `W/2 − (169 >> 1) = 36`. 탭 글씨 · 보상 · 성공 · 표시 네모가 모두 이 폭에서 잰다(0x1e026~0x1e034 · 0x1e0b0~0x1e0b8 ·
 * 0x1e0ee~0x1e0fa · 0x1e136~0x1e140 · 0x1e31e~0x1e32a · 0x1e648~0x1e654 · 0x1e6a2~0x1e6ac · 0x1e6e6~0x1e6f2).
 * *(정정 r129 — 전에는 판 폭 192 · 그림 폭 45 로 셌다)*
 */
const ROW_BASE_X = SCREEN_WIDTH / 2 - (169 >> 1)
/**
 * 탭 글씨 — slt_frame **이미지** 0x33 = 51 "MISSION"(45×8) 을 (기준 + 3 = 39, H/2 + 0x13 = 179) — 0x1e04a~0x1e078.
 * 칸 14(이벤트 미션)를 고르면 대신 이미지 0x34 = 52 를 (기준 + 0xf = 51, 179) — 0x1e01c~0x1e048.
 */
export const TAB_LABEL = { image: 51, x: ROW_BASE_X + 3, y: 179 } as const
export const EVENT_TAB_LABEL = { image: 52, x: ROW_BASE_X + 0xf, y: 179 } as const
/** 설명 상자 0xbb28d(120, 193, 173, 65, 2) — 가운데 기준이라 왼쪽 x = 120 − (173 >> 1) = 34 (1dfd2~1dfe2) */
export const DESCRIPTION_BOX = { centerX: 120, y: 193, width: 173, height: 65 } as const
/** 설명 글 — 흰 글 (45, 197, 폭 150) */
export const DESCRIPTION_TEXT = { x: 45, y: 197, width: 150 } as const

/**
 * 보상·성공 줄 (y0 + 0xbe = 241). img_text 88 "보상" 을 기준 + 10 = 46 (0x1e0ee~0x1e114) · 값 `"!C%dG"`(0xcd750) 를
 * (기준 + 0x24 = 72, 241, 폭 0x2e) — 0xba269 호출 1e672(칸 14 는 1e34c).
 */
export const REWARD_ROW = {
  y: 241,
  labelFrame: 88,
  labelX: ROW_BASE_X + 10,
  valueX: ROW_BASE_X + 0x24,
  valueWidth: 0x2e,
} as const
/** img_text 258 "성공" 을 기준 + 0x58 = 124 (0x1e136~0x1e158) · 값 `"!C%d회"`(0xcd758) (기준 + 0x72 = 150, 241, 폭 0x2e) — 1e6ca(칸 14 는 1e390) */
export const SUCCESS_ROW = { labelFrame: 258, labelX: ROW_BASE_X + 0x58, valueX: ROW_BASE_X + 0x72 } as const

/**
 * 등급 표시 네모 — 성공 값 바로 뒤 0x1e6ce~0x1e722: i = 0 .. 개수 − 1 에
 * `0xba759(slt_frame [this+0x78], 이미지 0x26, 종류 0, W/2 + (169 >> 1) − 0x27 + 8i, y0 + 0x84, 0, 0, 0, 1)` → (165 + 8i, 183).
 * 개수 = 레코드 byte1 `lsls #0x1c ; lsrs #0x1d` = (byte1 >> 1) & 7 — 보상 등급 d(0xa52b0 a52d8 과 같은 식, `missionRewardTierOf`).
 * 레코드는 칸 ≠ 14 면 모드 6 0xa5269 / 그 밖 0xa5295(칸)(0x1e558~0x1e5a6). 칸 14 는 받은 미션이 있을 때만 같은 꼴(0x1e4e2~0x1e53a)이고
 * 받은 미션이 없으면(웹은 늘) 0x1e394 에서 끝나 안 그린다. 잠긴 칸도 거르지 않는다.
 */
export const GRADE_MARKS = { image: 0x26, x: SCREEN_WIDTH / 2 + (169 >> 1) - 0x27, step: 8, y: 51 + 0x84 } as const

/**
 * 칸 14(이벤트 미션)에 받은 미션이 없을 때([[this+0x84]+0xa4] == 0 — 웹은 통신이 없어 늘 그렇다):
 * 제목 `"!C이벤트 미션"`(0xcd740) 을 미션 이름 자리(24, 58, 폭 0xc0) 에 같은 색 #335FCD 로 — 0xba269 호출 1e2a6.
 */
export const EVENT_MISSION_TITLE = '이벤트 미션'

/** 같은 때의 설명 StrMAINMENU[57] (45, 197, 폭 0x96, 흰 글) — 0x702b5(…, 0x39) → 0xba269 호출 1e302. 0x0a(!N)에서 줄을 끊는다 */
export const NO_MISSION_TEXT = ORIGINAL_MAIN_MENU_TEXT[57] ?? ''

/**
 * 미션 고르기 격자 [this+0x70] 의 꼴 — 장면 진입 0x1d9a4 가 `new` → 0x6c219(vtable 0xd2ea0) 뒤
 * `vt+0x14(0, 0)` · `vt+0x1c(격자, 5열, 3줄, 숫자키 꼴 1, 꼴 0x330)`(0x1d9cc~0x1d9f6) 로 짓는다.
 * 0x330 = 0x10 · 0x20(두 축 다 감기) + 0x100 · 0x200(감기면 다른 축 한 칸) — **15칸을 칸 번호 순으로 감으며 넘긴다**
 * (→ 칸 4 → 5 · 칸 14 → 0, ↓ 칸 10 → 1 · 칸 14 → 0, ← 칸 0 → 14). 숫자키 꼴 1 이라 '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK.
 * 칸 14 는 이벤트(다운로드) 미션 칸이다 — `EVENT_MISSION_CELL`.
 */
export const MISSION_GRID_SHAPE = {
  columns: GRID.columns,
  rows: GRID.rows,
  wrapsColumns: true,
  wrapsRows: true,
  carriesRowOnColumnWrap: true,
  carriesColumnOnRowWrap: true,
} as const

/** 이벤트 미션 칸 — 키 0x1daa4 의 0x1db06 `칸 == 14` */
export const EVENT_MISSION_CELL = 14

/**
 * 이벤트 미션 창 (0x741a1 높이 0x64 · 그리기 0x1dd58 — W 240 · H 320 기준 좌표).
 * 글 0x6ef4c 는 문자열 앞 `!C` 로 폭 안 가운데 맞춤이다.
 */
export const EVENT_MISSION_WINDOW = {
  height: 100,
  /** 0x741a0 의 [창+0x212] = 6 */
  openStartHeight: 6,
  /** StrMAINMENU[56] — (W/2 − 0x58, H/2 − 0x23, 폭 0xb0) */
  text: {
    raw: ORIGINAL_MAIN_MENU_TEXT[56] ?? '',
    x: SCREEN_WIDTH / 2 - 0x58,
    y: 320 / 2 - 0x23,
    width: 0xb0,
  },
  /** 0xcd6f0 / 고름 0xcd718 — (W/2 − 0x50, H/2 + 0x14, 폭 0x50) */
  run: { raw: '!C!cFFFFFF미션실행', selectedRaw: '!C!cFFFF00미션실행', x: SCREEN_WIDTH / 2 - 0x50, y: 320 / 2 + 0x14, width: 0x50 },
  /** 0xcd704 / 고름 0xcd72c — (W/2, H/2 + 0x14, 폭 0x50) */
  download: { raw: '!C!cFFFFFF미션다운', selectedRaw: '!C!cFFFF00미션다운', x: SCREEN_WIDTH / 2, y: 320 / 2 + 0x14, width: 0x50 },
} as const

/**
 * 미션실행을 골랐는데 받은 이벤트 미션이 없을 때([미션+0xa4] == 0) — 하위 상태 3(0x1dc00)이
 * `0x74ef5(창, 0xcd6c8, 종류 1)` 알림을 띄우고 하위 4 → 0 으로 목록에 돌아온다. 웹은 받을 길(통신)이 없어 늘 이 글이다.
 */
export const EVENT_MISSION_EMPTY_TEXT = '!C!cffffff이벤트 미션을 다운로드하세요'
