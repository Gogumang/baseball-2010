/**
 * **경기진행 설정 창**(원본 갱신 0x5fef4 · 키 0x5ffcc · 그리기 0x6042c)의 공개 API.
 *
 * 근거: `docs/re/J-modes-rules.md` J-3 · `docs/re/_raw/notes/R4-lineup-screens.md` 4절.
 *
 * 창은 상태를 저장하지 않는다 — 지금 설정을 받고, 확인창에서 '예' 를 누르면
 * 바뀐 `MatchProgressSettings` 를 `onConfirm` 으로 돌려준다. 저장 칸(모드 칸 m 은
 * 일반 0 · 시즌 1 · 대전 2)에 되쓰는 일은 부르는 쪽이 한다.
 *
 * 쓰는 곳:
 * - 일반모드 경기정보(상태 22)에서 '0'
 * - 시즌 경기 직전(상태 0xdd)에서 '0', 그리고 **한 번도 안 봤으면 저절로 열린다** (R13 4절)
 *
 * 시즌 세션은 지금 `FULL_PLAY_SETTINGS` 를 박아 넘기고 있다
 * (`src/app/model/useSeasonSession.ts`). 이 창이 돌려준 설정을 시즌 저장에 담아
 * `TeamGameOptions.settings` 로 넘기면 된다.
 */
export { MatchSettingsWindow, MatchSettingsScreen } from '@/pages/match-settings/ui/MatchSettingsWindow'
export type { MatchSettingsWindowProps } from '@/pages/match-settings/ui/MatchSettingsWindow'

/** 창 상태·키 처리 (0x5ffcc) — 화면 없이 규칙만 쓰고 싶을 때 */
export {
  SETTINGS_STAGE, DETAIL_ROW, DETAIL_ROW_COUNT, DETAIL_CELL_COUNTS,
  KIND_COUNT, CHANCE_VALUE_COUNT, INNING_VALUE_COUNT,
  openMatchSettings, pressMatchSettingsKey, answerMatchSettingsPopup,
  detailCellCountOf, detailBitsOf, toggleDetailBit, valueCountOf,
} from '@/pages/match-settings/lib/matchSettingsMenu'
export type {
  MatchSettingsAction, MatchSettingsKey, MatchSettingsPopup, MatchSettingsWindowState,
} from '@/pages/match-settings/lib/matchSettingsMenu'

/** 원본 문구·이름 그림 표 (R4 4절 · StrMAINMENU[121]~[126]) */
export {
  KIND_LABELS, KIND_LABEL_FRAMES, KIND_DESCRIPTIONS,
  CHANCE_DESCRIPTIONS, INNING_LABELS, INNING_LABEL_FRAMES, INNING_DESCRIPTIONS,
  DETAIL_ROW_LABELS, DETAIL_ROW_DESCRIPTIONS, CONFIRM_TEXT, NO_DETAIL_TEXT,
} from '@/pages/match-settings/lib/matchSettingsText'
