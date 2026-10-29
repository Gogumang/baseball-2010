import {
  EMPTY_MODE_SAVE,
  NEW_SAVE_LAST_PLAYED_MODE,
  NEW_SAVE_MATCH_SETTINGS,
  NO_NARI_GAME,
  type ModeMatchSettings,
  type ModeSave,
  type NariGameSave,
  type NariLeagueMode,
} from '@/entities/mode-save/model/modeSave/types'

/** 원본 모드 번호 범위 — 0x327b8 의 점프표 0xcf048 은 1~9 */
const MODE_LIMIT = 9

/** 저장소에서 읽은 객체(배열 포함)인가 */
const isObject = (raw: unknown): raw is object => raw !== null && typeof raw === 'object'

type SavedFields = Partial<Record<keyof ModeSave, unknown>>

/** +0x3c — 0~9 정수가 아니면(옛 세이브) 부르는 쪽이 넘긴 값 */
function lastPlayedModeOf(mode: unknown, legacyLastPlayedMode: number): number {
  const isValidMode = typeof mode === 'number' && Number.isInteger(mode) && mode >= 0 && mode <= MODE_LIMIT
  return isValidMode ? mode : legacyLastPlayedMode
}

/** 옛 세이브(칸 없음) — 대기가 하나면 그 편, 둘이면 알 수 없어 타자편(4)으로 둔다(웹 전용 메움) */
function aceMatchModeOf(value: SavedFields): number {
  const mode = value.aceMatchMode
  return typeof mode === 'number' && Number.isInteger(mode) ? mode : legacyAceMatchModeOf(value.aceMatchPending)
}

/** 옛 세이브(칸 없음)는 null — 시즌 세션이 시즌 저장의 값을 옮겨 온다 */
function seasonMatchSettingsOf(raw: unknown): ModeMatchSettings | null {
  return raw === null || raw === undefined ? null : normalizeModeMatchSettings(raw)
}

/** 옛 세이브(칸 없음)는 두 편 다 경기 저장 없음 — 예전 웹처럼 [최근게임]·[14] 가 나리 관리 장면으로 간다 */
function nariGamesOf(raw: unknown): ModeSave['nariGames'] {
  const nari = isObject(raw) ? (raw as Partial<Record<string, unknown>>) : {}
  return { 3: normalizeNariGame(nari[3]), 4: normalizeNariGame(nari[4]) }
}

/**
 * 저장소에서 읽은 값을 고른다. 칸이 없으면(옛 세이브) `legacyLastPlayedMode` 를 +0x3c 로 쓴다 —
 * 웹 [최근게임] 이 예전에는 늘 나만의리그 타자편 이어하기였으므로, 부르는 쪽이 타자편 커리어가 있으면 4 를 넘겨 그 길을 잇는다.
 * 안 넘기면 새 저장의 기본값 1 이다 (`NEW_SAVE_LAST_PLAYED_MODE`).
 */
export function normalizeModeSave(raw: unknown, legacyLastPlayedMode = NEW_SAVE_LAST_PLAYED_MODE): ModeSave {
  if (!isObject(raw)) return { ...EMPTY_MODE_SAVE, lastPlayedMode: legacyLastPlayedMode }
  const value = raw as SavedFields
  const generalGame = isObject(value.generalGame) ? value.generalGame : null
  return {
    lastPlayedMode: lastPlayedModeOf(value.lastPlayedMode, legacyLastPlayedMode),
    // 블록 없이 표시만 서 있을 수는 없다 — 원본은 블록과 표시를 같은 OK 에서 함께 쓴다
    isGeneralGameInProgress: value.isGeneralGameInProgress === true && generalGame !== null,
    generalGame,
    nariGames: nariGamesOf(value.nariGames),
    // 옛 세이브(칸 없음)는 대기 없음
    aceMatchPending: {
      3: normalizeAceMatchPending(value.aceMatchPending, 3),
      4: normalizeAceMatchPending(value.aceMatchPending, 4),
    },
    // 옛 세이브(칸 없음)는 SYS 8 이 적은 0(짐) 그대로
    aceMatchWon: { 3: aceMatchWonOf(value.aceMatchWon, 3), 4: aceMatchWonOf(value.aceMatchWon, 4) },
    aceMatchMode: aceMatchModeOf(value),
    // 옛 세이브(칸 없음)는 새 저장 값 — 일반모드 설정은 예전 웹이 저장하지 않았다
    generalMatchSettings: normalizeModeMatchSettings(value.generalMatchSettings),
    matchSettingsSeen: value.matchSettingsSeen === true,
    seasonMatchSettings: seasonMatchSettingsOf(value.seasonMatchSettings),
  }
}

const MATCH_SETTING_FIELDS = ['kind', 'value', 'battingOrderBits', 'pitchingInningBits', 'offenseRunnerBits', 'defenseRunnerBits'] as const

function normalizeModeMatchSettings(raw: unknown): ModeMatchSettings {
  if (!isObject(raw)) return NEW_SAVE_MATCH_SETTINGS
  const value = raw as Partial<Record<keyof ModeMatchSettings, unknown>>
  const isValid = MATCH_SETTING_FIELDS.every((field) => Number.isInteger(value[field]))
  if (!isValid) return NEW_SAVE_MATCH_SETTINGS
  return {
    kind: value.kind as number,
    value: value.value as number,
    battingOrderBits: value.battingOrderBits as number,
    pitchingInningBits: value.pitchingInningBits as number,
    offenseRunnerBits: value.offenseRunnerBits as number,
    defenseRunnerBits: value.defenseRunnerBits as number,
  }
}

function normalizeAceMatchPending(raw: unknown, mode: NariLeagueMode): readonly number[] | null {
  if (!isObject(raw)) return null
  const events = (raw as Partial<Record<string, unknown>>)[mode]
  return Array.isArray(events) && events.every((id) => typeof id === 'number' && Number.isInteger(id)) ? events : null
}

function aceMatchWonOf(raw: unknown, mode: NariLeagueMode): boolean {
  if (!isObject(raw)) return false
  return (raw as Partial<Record<string, unknown>>)[mode] === true
}

function legacyAceMatchModeOf(raw: unknown): number {
  if (normalizeAceMatchPending(raw, 4) !== null) return 4
  if (normalizeAceMatchPending(raw, 3) !== null) return 3
  return 0
}

function normalizeNariGame(raw: unknown): NariGameSave {
  if (!isObject(raw)) return NO_NARI_GAME
  const value = raw as Partial<Record<keyof NariGameSave, unknown>>
  const match = isObject(value.match) ? value.match : null
  return { isInProgress: value.isInProgress === true, match }
}
