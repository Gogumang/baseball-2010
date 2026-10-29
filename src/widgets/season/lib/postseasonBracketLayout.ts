/**
 * 포스트시즌 대진표 배치 (그리기 `0x853ac` — P6 4a-1 **확정**).
 *
 * 부르는 곳은 두 군데다: **시즌모드 `0xb7b8`**(= 장면 0x105 상태 **0xef** 의 그리기, R13 1절)와
 * 나만의리그 `0x168e8`. 원본은 mode_ui **프레임 53**(195×210: 위 "CHAMPION" 리본 + 계단식 팀 칸 4개
 * + 순위 딱지 4개)을 앵커 (0,0) 으로 통째로 깔고, 그 프레임 박스로 로고·딱지 자리를 잡는다.
 * 대진 선은 그림이 없는 **프레임 54~57**(박스만 있는 2px 선분 목록)이다.
 *
 * 시즌 상태 0xef(`SeasonSummaryScreen`)와 나만의리그 상태 128(`pages/season-end` 의 `PostseasonScreen`)이
 * 이 위젯 하나(`PostseasonBracketWindow`)를 함께 쓴다 — 원본도 같은 함수 0x853ac 다.
 *
 * - 팀 칸 · 순위 딱지 · 덮기 박스(`bracketBoxes`) · 대진 선 프레임 54~57(`bracketLines`)
 * - 진행 중인 시리즈에서 뽑는 대진표 상태(`bracketView`) · 순위 딱지 글자 자리(`rankTag`)
 */

export {
  BRACKET_BACKDROP,
  TEAM_CELLS,
  LOGO_INSET,
  RANK_TAGS,
  rankLabelOfCell,
  DARK_CELL_STEP,
  darkCellBoxOf,
} from '@/widgets/season/lib/postseasonBracketLayout/bracketBoxes'
export type { BracketBox } from '@/widgets/season/lib/postseasonBracketLayout/bracketBoxes'
export { LINE_FRAMES, lineFrameOfCell, LINE_COLOR, WON_LINE_COLOR } from '@/widgets/season/lib/postseasonBracketLayout/bracketLines'
export { bracketViewOf } from '@/widgets/season/lib/postseasonBracketLayout/bracketView'
export type { BracketView } from '@/widgets/season/lib/postseasonBracketLayout/bracketView'
export {
  RANK_UNIT,
  RANK_GLYPH_HEIGHT,
  rankGlyphsOf,
  rankUnitPositionOf,
  rankDigitRightOf,
  rankDigitBoxTopOf,
} from '@/widgets/season/lib/postseasonBracketLayout/rankTag'
