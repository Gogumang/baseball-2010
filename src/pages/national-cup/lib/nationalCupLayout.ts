import {
  HEADER_CELLS,
  HEADER_DIVIDER_COUNT,
  NATIONAL_MATCH_ROW_COUNT,
  PERCENT_OFFSET,
  RANK_GLYPH_HEIGHT,
  ROW_CELLS,
  ROW_FRAME,
  ROW_FRAME_ORIGIN,
  ROW_STEP,
  STANDINGS_WINDOW,
  TEAM_LABEL_BASE_FRAME,
  rankGlyphsOf,
  valueGlyphsOf,
  winningPercentOf,
} from '@/widgets/standings/lib/standingsLayout'

/**
 * 국가대항전 화면 배치.
 *
 * **순위 화면(나리 상태 134 · 시즌 243)은 순위표 `0x7f070` 를 그대로 쓴다.** 그 함수는
 * `L+0xac`(국가대항전 진행 플래그)가 서 있으면 `7f1d2` 에서 **4줄** 에서 멈춘다 —
 * `standingsLayout.ts` 의 `NATIONAL_MATCH_ROW_COUNT` 가 바로 그 값이다 (P5·P6 확정).
 * 팀 이름표도 같은 `img_text 65 + 팀번호` 라 10~13 이 **75·76·77·78 = 대한민국·일본·쿠바·미국** 이다.
 * 그래서 배치 상수는 새로 만들지 않고 순위표 것을 그대로 가져와 다시 내보낸다.
 */
export {
  HEADER_CELLS,
  HEADER_DIVIDER_COUNT,
  PERCENT_OFFSET,
  RANK_GLYPH_HEIGHT,
  ROW_CELLS,
  ROW_FRAME,
  ROW_FRAME_ORIGIN,
  ROW_STEP,
  STANDINGS_WINDOW,
  TEAM_LABEL_BASE_FRAME,
  rankGlyphsOf,
  valueGlyphsOf,
  winningPercentOf,
}

/** 대회 순위표는 **4줄** 이다 (`0x7f070` 의 `L+0xac` 가지) */
export const NATIONAL_CUP_ROW_COUNT = NATIONAL_MATCH_ROW_COUNT

export const SCREEN = { width: 240, height: 320 } as const

/**
 * ⚠️ **원본 배치 미해독 — 근사.**
 *
 * 매치업 화면(나리 상태 135 · 시즌 244)은 원본에 **들어옴 처리가 없고 키 처리(`0x10680`·`0x4a18`)만**
 * 있다. 그리기 함수를 P5·P6 어느 쪽도 짚지 못해 무엇을 그리는지 모른다.
 * 그래서 다른 화면들이 쓰는 **공용 판 (24, 54, 192, 212)** 관례로 짰다.
 * 원본 배치가 나오면 이 상수만 갈아 끼우면 된다.
 */
export const MATCHUP_PANEL = { x: 24, y: 54, width: 192, height: 212 } as const

/** ⚠️ 근사 — 판 안 제목 줄 (제 n 회 국가대항전) */
export const MATCHUP_TITLE = { x: MATCHUP_PANEL.x, y: MATCHUP_PANEL.y + 12, width: MATCHUP_PANEL.width } as const

/**
 * ⚠️ 근사 — 두 팀 로고를 판 가운데 좌우로 놓는다. 로고는 `team_logo` 한 장 32×32 다
 * (`teams.ts` 의 `logoUrl`).
 */
export const MATCHUP_LOGO_SIZE = 32
export const MATCHUP_SIDES = {
  /** 왼쪽 = 대한민국(내 팀), 오른쪽 = 상대 */
  leftX: MATCHUP_PANEL.x + 28,
  rightX: MATCHUP_PANEL.x + MATCHUP_PANEL.width - 28 - MATCHUP_LOGO_SIZE,
  logoY: MATCHUP_PANEL.y + 62,
  nameY: MATCHUP_PANEL.y + 100,
  nameWidth: 60,
} as const

/** ⚠️ 근사 — 가운데 "VS" 글자 자리 */
export const MATCHUP_VS = { y: MATCHUP_PANEL.y + 70 } as const

/** ⚠️ 근사 — 판 아래쪽 안내 줄. 아래 단추(38px)까지 판 안(y ≤ 266)에 들어오게 잡았다 */
export const MATCHUP_HINT = { x: MATCHUP_PANEL.x, y: MATCHUP_PANEL.y + 130, width: MATCHUP_PANEL.width } as const
/** ⚠️ 근사 — 단추 줄 */
export const MATCHUP_BUTTONS = { x: MATCHUP_PANEL.x, y: MATCHUP_HINT.y + 32, width: MATCHUP_PANEL.width } as const

/** 단계(`L+0xad`) → 그 날의 이름. 4·3·2 는 풀리그 1·2·3라운드, 1 은 결승이다 */
export function nationalCupRoundLabelOf(stage: number): string {
  if (stage <= 0) return '대회 종료'
  if (stage === 1) return '결승'
  return `풀리그 ${4 - stage + 1}라운드`
}
