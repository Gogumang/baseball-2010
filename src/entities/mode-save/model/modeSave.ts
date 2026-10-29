/**
 * **모드 저장 칸** — 원본 전역기록(`0x1f1d9(저장)`)의 마지막 모드 · 경기 중간 저장 표시 · 경기진행 설정 · 마선수 대결 대기 칸과
 * 일반모드(모드 1) 저장 블록 (뜻과 근거는 `modeSave/types` 머리 주석).
 *
 * 공개 이름 모음 — 하위 폴더 (`modeSave/`): `types`(저장 꼴 · 새 저장 0x9f26c) · `normalize`(옛 세이브 메우기) ·
 * `updates`(마지막 모드 0x327b8 · 일반 경기 0x3136e · 0x4f928 · 0x4ea0c · 나리 경기 0x13cca · 설정 0x60376 · 0x11e) ·
 * `aceMatch`(마선수 대결 대기 SYS 8 0x8d764 · 140 0x10df8 · 정산 0x4ea0c 덮어쓰기)
 */
export {
  EMPTY_MODE_SAVE,
  NEW_SAVE_LAST_PLAYED_MODE,
  NEW_SAVE_MATCH_SETTINGS,
  type ModeMatchSettings,
  type ModeSave,
  type NariLeagueMode,
} from '@/entities/mode-save/model/modeSave/types'
export { normalizeModeSave } from '@/entities/mode-save/model/modeSave/normalize'
export {
  withGeneralGameFinished,
  withGeneralGameResumed,
  withGeneralGameSaved,
  withGeneralGameStarted,
  withGeneralMatchSettings,
  withLastPlayedMode,
  withMatchSettingsSeen,
  withNariGameCleared,
  withNariGameStarted,
  withSeasonMatchSettings,
} from '@/entities/mode-save/model/modeSave/updates'
export {
  aceMatchHoldOf,
  createMemoryAceMatchPendingPort,
  isAceMatchHeld,
  NO_ACE_MATCH_HOLD,
  withAceMatchCleared,
  withAceMatchHeld,
  withAceMatchResultWritten,
  type AceMatchHold,
  type AceMatchHoldPort,
  type AceMatchPendingPort,
} from '@/entities/mode-save/model/modeSave/aceMatch'
