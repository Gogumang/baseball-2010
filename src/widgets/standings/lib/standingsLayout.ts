import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'

/**
 * 팀 순위표(기록실) 원본 배치 — binary.mod 0x7f070 (layout-re 4차 명세, 표는 바이트 확인).
 * 공용 창 0x55e60 을 mode_ui f18 박스0 에 깔고, 머리칸은 f18 박스1~5, 줄은 f19 를 y+18i 에 그린다.
 */

/** 창 — mode_ui f18 박스0 */
export const STANDINGS_WINDOW = { x: 14, y: 47, width: 212, height: 220 } as const

export interface StandingsBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 머리칸 — f18 박스1~5 에 img_text 표 0xd4908 을 팔레트3(남색)으로 가운데 */
export const HEADER_CELLS: readonly (StandingsBox & { readonly frame: number })[] = [
  { x: 18, y: 52, width: 29, height: 14, frame: 136 },
  { x: 48, y: 52, width: 83, height: 14, frame: 235 },
  { x: 133, y: 52, width: 24, height: 14, frame: 215 },
  { x: 159, y: 52, width: 26, height: 14, frame: 216 },
  { x: 187, y: 52, width: 32, height: 14, frame: 234 },
]

/** 머리칸 네 개의 오른쪽 끝에 세로선을 긋는다 */
export const HEADER_DIVIDER_COUNT = 4

/** 줄 배경 그림 (mode_ui f19) 과 그 원점 — 줄마다 18px 씩 내려 그린다 */
export const ROW_FRAME = 19
export const ROW_FRAME_ORIGIN = { x: 20, y: 78 } as const
export const ROW_STEP = 18
/**
 * 정규 시즌 10줄. `[+0xac]` 가 서면 4줄인데, 이 플래그는 포스트시즌이 아니라
 * **국가대항전 진행 중** 표시다 (P5 확정, P1 의 "포스트시즌 플래그" 는 오독이었다).
 * 4줄은 대회에 나온 **4개국** 순위다 — 국가대항전을 만들 때 쓰면 된다.
 */
export const ROW_COUNT = 10
export const NATIONAL_MATCH_ROW_COUNT = 4

/** 줄 안의 칸 — f19 박스0~4 (첫 줄 기준 y, 아랫 줄은 +18i) */
export const ROW_CELLS = {
  rank: { x: 20, y: 78, width: 25, height: 15 },
  team: { x: 47, y: 78, width: 83, height: 15 },
  wins: { x: 132, y: 78, width: 25, height: 15 },
  losses: { x: 159, y: 78, width: 25, height: 15 },
  winningPercent: { x: 186, y: 78, width: 24, height: 15 },
} as const satisfies Readonly<Record<string, StandingsBox>>

/** 승률 칸 뒤 "%" 는 박스x+25, 박스y+5 에 놓는다 */
export const PERCENT_OFFSET = { x: 25, y: 5 } as const

/** 팀 이름표 = img_text 65 + 팀번호 (흰 팔레트) */
export const TEAM_LABEL_BASE_FRAME = 65

/** 순위는 하늘색 숫자, 승·패·승률은 기본 주황 숫자다 (글자 치수는 공용 pixelNumber) */
export { SKY_BLUE_GLYPH_HEIGHT as RANK_GLYPH_HEIGHT, skyBlueNumberGlyphsOf as rankGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'

export const valueGlyphsOf = numberGlyphsOf

/** 승률 = 승×100÷(승+패) 정수 퍼센트. 소수점이 없고 한 경기도 치르지 않았으면 0 이다 */
export function winningPercentOf(wins: number, losses: number): number {
  const played = wins + losses
  return played === 0 ? 0 : Math.trunc((wins * 100) / played)
}
