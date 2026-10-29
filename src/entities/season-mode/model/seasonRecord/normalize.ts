import type { SeasonDayBoard, SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord/types'
import {
  DAY_BOARD_SIZE,
  emptySeasonDayBoard,
  falses,
  GAME_RECORD_SIZE,
  initialTeamAbilities,
  MORALE_LIMIT,
  OUTING_SUB_ITEM_SIZE,
  STADIUM_EQUIPPED_SIZE,
  STADIUM_OWNED_SIZE,
  TRAINING_SUB_ITEM_SIZE,
  zeros,
} from '@/entities/season-mode/model/seasonRecord/layout'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord/seasonYear'

/**
 * 옛 세이브 메우기 — 저장 뒤에 늘어난 칸을 기본값으로 채운다.
 *
 * 시즌 세이브에는 지금까지 정규화가 없어서, 필드가 늘기 전에 저장한 세이브를 불러오면
 * 배열 칸이 `undefined` 인 채로 흘러 **경기 한 판만 끝내도 터졌다**:
 *   `evaluateSeasonGame` → `seasonReputationChangeOf(record.gameRecord, …)` →
 *   `seasonReputation.ts` 의 `score -= s[1]` 에서 `undefined[1]`.
 * 관중 수입 정산(`boardBonusOf` → `record.stadiumEquipped[0]`)과 구장 상점도 같은 이유로 터졌다.
 *
 * 나만의리그 쪽 `normalizeCareer` 와 같은 자세다 — **값은 손대지 않고 빠진 칸만 채운다.**
 * 길이가 모자란 배열도 뒤를 기본값으로 늘려 준다 (칸이 늘어난 경우).
 */
export function normalizeSeasonRecord(saved: Partial<SeasonRecord> | null | undefined): SeasonRecord {
  const base = startNewSeason(saved?.teamId ?? 0, saved?.name ?? '').record
  if (saved === null || saved === undefined) return base
  return {
    ...base,
    ...saved,
    trainingSubItems: padFlags(saved.trainingSubItems, TRAINING_SUB_ITEM_SIZE),
    outingSubItems: padFlags(saved.outingSubItems, OUTING_SUB_ITEM_SIZE),
    gameRecord: padNumbers(saved.gameRecord, GAME_RECORD_SIZE),
    stadiumOwned: padFlags(saved.stadiumOwned, STADIUM_OWNED_SIZE),
    stadiumEquipped: padNumbers(saved.stadiumEquipped, STADIUM_EQUIPPED_SIZE),
    seenEvents: Array.isArray(saved.seenEvents) ? saved.seenEvents : [],
    dayBoard: normalizeDayBoard(saved.dayBoard),
  }
}

/** 옛 세이브(점수표 칸이 없던 때)는 빈 표로, 짧은 줄은 뒤를 0 으로 채운다 */
function normalizeDayBoard(saved: Partial<SeasonDayBoard> | undefined): SeasonDayBoard {
  if (saved === undefined || saved === null) return emptySeasonDayBoard()
  return {
    teamsA: padNumbers(saved.teamsA, DAY_BOARD_SIZE),
    teamsB: padNumbers(saved.teamsB, DAY_BOARD_SIZE),
    scoresA: padNumbers(saved.scoresA, DAY_BOARD_SIZE),
    scoresB: padNumbers(saved.scoresB, DAY_BOARD_SIZE),
  }
}

/** 옛 세이브에서 읽은 시즌 상태 — 안쪽 레코드도 칸이 빠져 있을 수 있다 */
export type SavedSeasonState = Partial<Omit<SeasonState, 'record'>> & { readonly record?: Partial<SeasonRecord> }

/** 옛 세이브 메우기 (상태 전체) — 사기·팀 능력치까지 본다 */
export function normalizeSeasonState(saved: SavedSeasonState | null | undefined): SeasonState {
  const record = normalizeSeasonRecord(saved?.record)
  const abilities = saved?.teamAbilities
  return {
    record,
    teamMorale: typeof saved?.teamMorale === 'number' ? saved.teamMorale : MORALE_LIMIT,
    teamAbilities:
      Array.isArray(abilities) && abilities.length > 0 ? abilities.map((row) => (Array.isArray(row) ? [...row] : [])) : initialTeamAbilities(),
  }
}

function padFlags(saved: readonly boolean[] | undefined, size: number): readonly boolean[] {
  if (!Array.isArray(saved)) return falses(size)
  return Array.from({ length: size }, (_unused, index) => saved[index] ?? false)
}

function padNumbers(saved: readonly number[] | undefined, size: number): readonly number[] {
  if (!Array.isArray(saved)) return zeros(size)
  return Array.from({ length: size }, (_unused, index) => saved[index] ?? 0)
}
