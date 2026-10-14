/**
 * **경기 시작 인트로 그리기 0x417ac 의 자리** — 직접 떴다(0x417ac~0x41a10).
 *
 * ```
 * 417e4  0x40ff0(장면, (s16)+0x17e2)                         ; 배경 고르기 — 구장 · 바닥을 카운터만큼 내린다
 * 417e8  y0 = 0xbaa8c() + 40 ; 0x6a9f0(g, 0, y0, W, 30, 0x304ea2 | max(1, +0x17e4 − 0x55) << 24)   ; 반투명 파랑 띠
 * 41830  w = 0xba815(game_ui, 8, 1)(프레임 8 의 폭) ; x0 = W/2 − w/2
 * 41862  0xba759(game_ui, 8, 1, x0, 0xbaa8c() + 0x23, 효과, 인자, 0, 1)                 ; 짙은 남색 둥근 막대
 * 418b6  모드 1 이면 n = (s8)st+0x30(구장 번호), 아니면 n = 0xb6bdc(st, 1)(홈 팀)
 *        0x913e5(img_text, 0) · 0xba759(img_text, 0x41 + n, 1, x0 + 0x19, 0xbaa8c() + 0x2b, 효과, 인자, 0, 1)   ; 팀 이름 글씨
 * 419b2  0xba759(img_text, 0xb9, 1, x0 + 0x64, 0xbaa8c() + 0x2b, 효과, 인자, 0, 1)                         ; "스타디움"
 * 419f4  0x41440(장면, W/2 − 120, H/2 − 70, 효과, 인자, 0)                             ; 점수판 틀
 * 41a00  +0x194a(라이벌전) && +0x17e6 > 14 → 0x3b80c                                    ; 라이벌전 9프레임 띠
 * ```
 * 효과 · 인자 = `[+0x17e6] ≤ 14` 면 효과 1 · 인자 [+0x17e6], 아니면 효과 0 (417ce~417d8) — 점수판 틀과 같은 값이다
 * (`introScoreboardEffectOf`).
 *
 * **세로 보정 `0xbaa8c()`** = 전역 [0x15606f4] — 시작 0x2ed8 의 321a 가 `(H − 0xcb9d0[1]) >> 1` = `(H − 290) >> 1` 로 한 번 적는다
 * (화면 높이 0x14008c8). 240×320 이면 **15** 다. 그래서 띠는 y 55, 막대는 50, 글씨는 58 이다.
 */

/** 화면 240×320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 0x321a 가 [0x15606f4] 에 적을 때 빼는 기준 높이 — 표 0xcb9d0 = (202, 290) 의 [1] */
const BASE_HEIGHT = 290

/** `0xbaa8c()` — `(H − 290) >> 1` */
export const SCREEN_Y_ADJUST = (SCREEN_HEIGHT - BASE_HEIGHT) >> 1

/** 띠 0x6a9f0(g, 0, 0xbaa8c() + 40, W, 30, …) */
export const INTRO_BAND = { x: 0, y: SCREEN_Y_ADJUST + 40, width: SCREEN_WIDTH, height: 30 } as const
/** 띠 색 0x304ea2 (알파는 윗바이트 — `introBandAlphaOf`) */
export const INTRO_BAND_RGB = { r: 0x30, g: 0x4e, b: 0xa2 } as const

/** 막대 = game_ui 프레임 8 (171×25 짙은 남색 둥근 막대) */
export const INTRO_BAR_FRAME = 8
/** game_ui 프레임 8 의 폭 — 0xba815 가 잰다 (`game_ui/frames/origins.json` "008", 원점 (0, 0)) */
export const INTRO_BAR_WIDTH = 171
/** x0 = W/2 − 폭/2 (41852~41860 — 폭/2 는 0 쪽 버림) */
export const INTRO_BAR_X = (SCREEN_WIDTH >> 1) - Math.trunc(INTRO_BAR_WIDTH / 2)
/** 막대 y = 0xbaa8c() + 0x23 */
export const INTRO_BAR_Y = SCREEN_Y_ADJUST + 0x23

/** 글씨 줄 y = 0xbaa8c() + 0x2b — 팀 이름 · "스타디움" 이 같은 줄이다 */
export const INTRO_TEXT_Y = SCREEN_Y_ADJUST + 0x2b
/** 팀 이름 글씨 x = x0 + 0x19 */
export const INTRO_TEAM_NAME_X = INTRO_BAR_X + 0x19
/** "스타디움" 글씨 x = x0 + 0x64 */
export const INTRO_STADIUM_LABEL_X = INTRO_BAR_X + 0x64
/** img_text 프레임 185(0xb9) = "스타디움" (S10 3-1) */
export const INTRO_STADIUM_LABEL_FRAME = 0xb9
/** 팀 이름 글씨 = img_text 0x41 + n */
const TEAM_NAME_BASE_FRAME = 0x41
/** 구장 번호를 쓰는 모드 — 일반모드 (418b6 `cmp r3, #1`) */
const GENERAL_MODE = 1

/**
 * 팀 이름 글씨의 n — 모드 1 이면 경기 상태 st+0x30(구장 번호 — 일반모드 준비 기록 rec+0xc, 9 보다 크면 "랜덤" 칸 그대로),
 * 그 밖은 홈(측 1) 팀 `0xb6bdc(st, 1)`. 모드 1 인데 구장 번호가 없으면(웹이 안 넘긴 경기) 홈 팀으로 둔다.
 */
export function introStadiumNameFrameOf(mode: number, stadiumId: number | null | undefined, homeTeam: number): number {
  const n = mode === GENERAL_MODE && stadiumId != null ? stadiumId : homeTeam
  return TEAM_NAME_BASE_FRAME + n
}
