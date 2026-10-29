import { PANEL } from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'

/**
 * 기록·통계 탭의 목록 격자 — 탭 0 `0x79ed5(격자, 종류, 120, y0 + 0x24 = 90, 칸너비 [174], 줄높이 18, 1열, 8줄)` (0x2e8e6~0x2e92e) ·
 * 탭 4 는 같은 꼴에 종류 2 · **y0 + 0x23 = 89** (0x2f96a~0x2f9ae). 칸 x = 120 − 174/2 = 33, 칸 y = 첫 y + 18 × 줄.
 * `x` 는 칸 바탕 프레임을 놓는 x(= 칸 x − 1)다. 칸 그리기 0x7a571 은 칸 (x, y) 와 칸너비 174 로 글을 놓는다 —
 * 이름 (칸 x + 5, 칸 y + 2)(0x7a98c~0x7a9a2) · 0x7a08c(격자, 칸 x, 칸 y + 2, 칸너비 [격자+0x1c+4열], n)(0x7a9b4~0x7aa26).
 * *(정정 r129 — 전에는 글을 프레임 x 32 · 폭 176 에서 셌다)*
 */
export const LIST_GRID = { x: PANEL.x + 8, cellX: PANEL.x + 9, cellWidth: 174, firstY: PANEL.y + 36, step: 18, rows: 8 } as const

/** 탭 0 칸 이름 `"%s"`(0xd09bc) StrGAME[8 + n] 흰 글 — 0xba269(글, 칸 x + 5, 칸 y + 2, 폭 자리 = RGB(255,255,255) 값, −1, 0) 호출 7a9a2. 폭 자리에 색이 들어가 줄을 안 끊는다 */
export const LIST_NAME = { dx: 5, dy: 2 } as const

/**
 * 탭 4 통계 — 0x7a08c 종류 2 갈래. 값 `"!R!cffff00…"` 은 0xba269(글, x − 2, y, 칸너비 − 4)(7a1f8 · 7a2b2 · 7a306 · 7a366 ·
 * 7a3ba · 7a418 · 7a4b6 · 7a502 — 8갈래 모두 `subs r1,#2` · `subs r3,#4`), 이름 `"!cffffff%s"`(0xd09a8) 은
 * 0xba269(글, x + 3, y + 1, 칸너비 − 10)(7a52e~7a542). 여기 x·y 는 0x7a08c 가 받은 (칸 x, 칸 y + 2) 다.
 */
export const STAT_VALUE = { dx: -2, dy: 2, widthInset: 4 } as const

export const STAT_NAME = { dx: 3, dy: 3, widthInset: 10 } as const

/** 탭 4 통계 격자의 첫 칸 y — 0x2f9a6 `adds r3, #0x23` (탭 0 은 #0x24) */
export const STAT_LIST_FIRST_Y = PANEL.y + 0x23

/** 탭별 목록 격자 첫 칸 y (탭 0 · 4 만) */
export const listFirstYOf = (tab: number) => (tab === 4 ? STAT_LIST_FIRST_Y : LIST_GRID.firstY)

/**
 * 칸 바탕 — 0x7a571 의 종류별 칸 그리기(점프표 0xd40c0)가 칸마다 slt_frame **프레임**(0xba759 종류 1)을 (칸 x − 1, 칸 y − 1) 에:
 * 종류 0 → 10 · 종류 1 → 11 (0x7a928~0x7a954) · 종류 2 → 13 (0x7a9cc~0x7a9fe). 모두 174×18.
 * 탭 0 의 종류는 `쪽 [skin+0xfc] == 5 ? 1 : 0` (0x2e900~0x2e90a) — 스페셜기록 쪽(6쪽째)만 11 이다. 탭 4 는 늘 종류 2.
 */
export function listRowFrameOf(tab: number, page: number): number {
  if (tab === 4) return 13
  return page === 5 ? 11 : 10
}

export const LIST_ROW_FRAME_DY = -1

/**
 * **줄 커서** — 0x7a571 꼬리(0x7b3a0~0x7b406, 직접 떴다). 열림 애니가 끝났고(+9) 커서를 보이고(+6) 깜박임이 켜졌으면
 * 종류 0·1·2 는 점프표 0xd4118 → 0x7b3de: slt_frame 프레임 `셋째 인자 == 3 ? 0x36 : 0x19` 를 (고른 칸 x − 1, 고른 칸 y − 2) 에.
 * 기록연감은 셋째 인자 0 (0x2e9a6 · 0x2fa34) 이라 **프레임 25** (174×20 노란 테두리). 고른 칸 x·y 는 흔들림이 더해진 값이다.
 */
export const LIST_CURSOR = { frame: 0x19, dy: -2 } as const

/**
 * **탭 0 기록의 칸 이름** — 격자 종류 1 칸 그리기 0x7a916 이 칸 번호 n(= 쪽 × 8 + 줄)의 이름을 글 표 `[격자+0x90]` 의
 * `n + 8` 번(0x7a964~0x7a970)으로 찍는다 = StrGAME[8 + n]. 0~39 는 경기 기록(`RECORD_NAMES`), 40~47 은 아래 여덟
 * (StrGAME[48~55] — 끝 공백도 원본 글 그대로)이다.
 */
export const SPECIAL_RECORD_NAMES = [
  '시즌모드 리그 1위 1회',
  '시즌모드 리그 1위 5회',
  '시즌모드 리그 1위 10회',
  '미션모드 모두 성공',
  '기록달성 모두 성공 ',
  '스킬 모두 수집 ',
  '닉네임 모두 수집 ',
  '엔딩 모두 수집 ',
] as const

/** 달성 표시 칸이 시작하는 칸 번호 — 0x7a08c 의 `n > 0x27` 갈래 (`0x22db4(mgr, n − 0x28)`) */
export const SPECIAL_RECORD_FIRST_CELL = 0x28
