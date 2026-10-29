import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { GENERAL_ENTRY_CELL_SOURCE, aceCellsOf, seasonEntryCellsOf } from '@/entities/season-mode/model/seasonEntry/cells/entryCells'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/season-mode/model/seasonEntry/otherSlices'
import { aceFaceAbilityOf, playerFaceOf } from '@/entities/season-mode/model/seasonEntry/roster/face'
import type { PlayerFace } from '@/entities/season-mode/model/seasonEntry/roster/face'
import {
  NOT_IN_ROSTER,
  SEASON_RECORD_ACE_BATTER_SLOT,
  SEASON_RECORD_ACE_PITCHER_SLOT,
  rotatedPitchersOf,
  seatAce,
  unrotatedPitchersOf,
} from '@/entities/season-mode/model/seasonEntry/roster/seats'
import type {
  SeasonEntryBatter,
  SeasonEntryCellSource,
  SeasonEntryLists,
  SeasonEntryPitcher,
} from '@/entities/season-mode/model/seasonEntry/types/entryLists'
import type { SeasonRecordAces } from '@/entities/season-mode/model/seasonEntry/types/records'

/** 줄마다 이름 · 능력치를 고르는 길 — 보통은 `playerFaceOf`, 레코드 차례 목록은 `nameOf` 이름을 덮는다 */
type FaceOf = (player: SeasonPlayer, isPitcher: boolean, index: number) => PlayerFace

/** 마선수가 없는 자리 (`SeasonRecordAces` 의 −1) */
const NO_ACES: SeasonRecordAces = { pitcher: -1, batter: -1 }

export interface SeasonEntryInput {
  /** 이름을 빌려 올 팀 (국가대항전 내 쪽이면 10) */
  readonly teamId: number
  readonly roster: SeasonTeamRoster
  /** 로테이션 날짜 g — 경기 옵션의 `dayCounter`(상대는 `opponentDayCounter`) */
  readonly dayCounter: number
  /** 0x6548 이 넣은 마투수 0..4 (없으면 −1) */
  readonly acePitcherId: number
  /** 0x6548 이 넣은 마타자 0..4 (없으면 −1) */
  readonly aceBatterId: number
  /**
   * 마선수 레벨 열 칸(전역 `mgr[0x13a..0x143]`, `useAceLevels().levels`) — 마선수 두 줄의 능력치 `0xb6415(rec, k, 1)` 첫 단계
   * 레벨 배율(b6438 `v · 0xd88aa[mgr[0x13a + 순번]] / 100`)이 본다. 안 넘기면 모두 Lv1
   */
  readonly aceLevels?: Readonly<Record<number, number>> | undefined
  /** 엔트리 목록 창 칸 재료 — 안 주면 일반모드 꼴(`GENERAL_ENTRY_CELL_SOURCE`) */
  readonly cells?: SeasonEntryCellSource
}

/** 0xe0 에 들어왔을 때 편집기 목록 — 로테이션을 돈 투수 배열과 마선수 두 칸을 끼운 모양 */
export function seasonEntryListsOf(input: SeasonEntryInput): SeasonEntryLists {
  const { teamId, roster, dayCounter } = input
  const cells = input.cells ?? GENERAL_ENTRY_CELL_SOURCE
  const faceOf: FaceOf = (player, isPitcher, index) => playerFaceOf(teamId, player, isPitcher, index)
  const batters = batterRowsOf(teamId, roster, cells, faceOf)
  const pitchers = rotatedPitchersOf(pitcherRowsOf(teamId, roster, cells, faceOf), dayCounter)
  return withSeatedAces({ batters, pitchers }, { pitcher: input.acePitcherId, batter: input.aceBatterId }, input.aceLevels, cells)
}

/**
 * 팀 레코드 차례 그대로의 편집기 목록 — 시즌 0xdf(0x5980) · 0xe5(0x5cd0) · 0xe6(0x5b28) · 0xe8(0x5870) 은 0x5561c 에 레코드를 그대로
 * 넘긴다(투수는 로테이션으로 섞인 레코드 차례). 이름은 `playerFaceOf`, `nameOf` 가 있으면 그것(표 밖 명전 기록 이름).
 *
 * 0xdf · 0xe5 는 진입 첫머리에 `0xb512c` 로 열 팀 마선수를 빼고(0xe6 은 0xe5 · 0xe7 에서만 온다 — 0x7240 · 0xc6aa) 0xe8(0x5870)은
 * 안 뺀다 — 그래서 `recordAces` 는 0xe8 만 넘긴다: 레코드에 남은 마선수를 8 · 9번에 앉힌 모양(`SeasonRecordAces`, 원본 그대로).
 */
export function seasonRecordEntryListsOf(
  teamId: number,
  roster: SeasonTeamRoster,
  cells: SeasonEntryCellSource,
  nameOf?: (player: SeasonPlayer, isPitcher: boolean, index: number) => string | undefined,
  recordAces?: SeasonRecordAces,
  aceLevels?: Readonly<Record<number, number>>,
): SeasonEntryLists {
  const faceOf: FaceOf = (player, isPitcher, index) => {
    const face = playerFaceOf(teamId, player, isPitcher, index)
    const name = nameOf?.(player, isPitcher, index)
    return name === undefined ? face : { ...face, name }
  }
  const batters = batterRowsOf(teamId, roster, cells, faceOf)
  const pitchers = pitcherRowsOf(teamId, roster, cells, faceOf)
  return withSeatedAces({ batters, pitchers }, recordAces ?? NO_ACES, aceLevels, cells)
}

function batterRowsOf(teamId: number, roster: SeasonTeamRoster, cells: SeasonEntryCellSource, faceOf: FaceOf): SeasonEntryBatter[] {
  return roster.batters.map((player, index): SeasonEntryBatter => {
    const face = faceOf(player, false, index)
    return {
      ...face,
      ...seasonEntryCellsOf(teamId, player, false, index, face.ability, cells),
      isAce: false,
      position: player.fieldPosition & 0xf,
      rosterIndex: index,
    }
  })
}

function pitcherRowsOf(teamId: number, roster: SeasonTeamRoster, cells: SeasonEntryCellSource, faceOf: FaceOf): SeasonEntryPitcher[] {
  return roster.pitchers.map((player, index): SeasonEntryPitcher => {
    const face = faceOf(player, true, index)
    return { ...face, ...seasonEntryCellsOf(teamId, player, true, index, face.ability, cells), isAce: false, rosterIndex: index }
  })
}

/** 마투수를 8번(`0xb521c`) · 마타자를 9번(`0xb53f0`)에 앉힌다 — 번호가 표 밖(−1)이면 그 칸은 그대로 */
function withSeatedAces(
  lists: SeasonEntryLists,
  aces: SeasonRecordAces,
  levels: Readonly<Record<number, number>> | undefined,
  cells: SeasonEntryCellSource,
): SeasonEntryLists {
  const acePitcher = ACE_PITCHERS[aces.pitcher]
  const pitchers =
    acePitcher === undefined
      ? lists.pitchers
      : seatAce(lists.pitchers, SEASON_RECORD_ACE_PITCHER_SLOT, acePitcherRowOf(acePitcher, aces, levels, cells))
  const aceBatter = ACE_BATTERS[aces.batter]
  const batters =
    aceBatter === undefined
      ? lists.batters
      : seatAce(lists.batters, SEASON_RECORD_ACE_BATTER_SLOT, aceBatterRowOf(aceBatter, aces.batter, levels, cells))
  return { batters, pitchers }
}

function acePitcherRowOf(
  ace: AcePlayer,
  aces: SeasonRecordAces,
  levels: Readonly<Record<number, number>> | undefined,
  cells: SeasonEntryCellSource,
): SeasonEntryPitcher {
  const ability = aceFaceAbilityOf(ace, aces.pitcher, levels)
  return {
    name: ace.name,
    ability,
    ...aceCellsOf(ace, aces.pitcher, ability, true, cells, aces.pitcherStamina),
    isAce: true,
    rosterIndex: NOT_IN_ROSTER,
  }
}

function aceBatterRowOf(
  ace: AcePlayer,
  aceId: number,
  levels: Readonly<Record<number, number>> | undefined,
  cells: SeasonEntryCellSource,
): SeasonEntryBatter {
  const ability = aceFaceAbilityOf(ace, aceId, levels)
  return {
    name: ace.name,
    ability,
    ...aceCellsOf(ace, aceId, ability, false, cells),
    isAce: true,
    position: 0,
    rosterIndex: NOT_IN_ROSTER,
  }
}

/**
 * 고친 편집기 목록을 시즌 명단으로 되적는다 — 마선수 줄을 빼고(움직일 수 없으니 남은 순서가 곧 명단 순서다)
 * 투수는 로테이션을 되돌린다. 타자는 편집기가 고친 수비 위치를 `+0x1c` 에 적는다.
 */
export function seasonRosterOfEntry(roster: SeasonTeamRoster, lists: SeasonEntryLists, dayCounter: number): SeasonTeamRoster {
  const batters: SeasonPlayer[] = []
  for (const row of lists.batters) {
    const player = roster.batters[row.rosterIndex]
    if (row.isAce || player === undefined) continue
    batters.push({ ...player, fieldPosition: (player.fieldPosition & ~0xf) | (row.position & 0xf) })
  }
  const pitcherView: SeasonPlayer[] = []
  for (const row of lists.pitchers) {
    const player = roster.pitchers[row.rosterIndex]
    if (row.isAce || player === undefined) continue
    pitcherView.push(player)
  }
  return { batters, pitchers: unrotatedPitchersOf(pitcherView, dayCounter) }
}

/** 0xdd 경기정보 "선발" 줄 = 투수 0번 (0x5e0e8) — 로테이션을 돈 명단의 0번 */
export function seasonStarterNameOf(teamId: number, roster: SeasonTeamRoster, dayCounter: number): string | null {
  const lists = seasonEntryListsOf({ teamId, roster, dayCounter, acePitcherId: -1, aceBatterId: -1 })
  return lists.pitchers[0]?.name ?? null
}
