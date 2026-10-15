/**
 * **나만의리그 143 경기 전 엔트리 보기** — 진입 `0x16af8` · 키 `0x1457c` · 그림 `0x16738` (직접 떴다, 장면 0x106 모드 3·4 공용).
 *
 * 진입 0x16af8:
 * ```
 * 16b10  S+0x12c(국가대항전) ? 두 팀 = 0xb7615(L, 대회 날, 0/1) : 내 팀 = S[1] · 상대 = 0xb765d(L, 내 팀)
 * 16b7a  [장면+0x164] ≠ 0 ('4'/왼) → 내 팀 · 0 ('6'/오른) → 상대 팀
 * 16b8a  명부 = 0x1f9a9(저장, [장면+0xcc] 모드, 팀)            ; 저장의 나리 팀 레코드 그대로
 * 16bc4  0x5561c(편집기, &명부, **0**, [장면+0x164], 1)       ; 셋째 인자 0 → +0x330 = −1 **보기 전용** (5568a), 다섯째 1 → 투수 탭
 * 16bd4  0x5570d · 0x55799(편집기, 3, 10) · 0x557c1 두 열 · 편집기+0x333 = 1 · +0x334 = 모드
 * ```
 * 곧 **143 은 고치지 못한다** — 셋째 인자가 0 이라 내 팀이든 상대 팀이든 OK 가 먹지 않는다(편집기 0x55864 의 55ae6).
 * 5eae5b5 의 "0(고칠 수 있음)" 은 인자를 반대로 읽었다. '*' 탭 뒤집기 · '0' 상세 · 위·아래는 먹는다.
 *
 * 키 0x1457c — `0x55864(편집기, 키)` 뒤 끝 코드 `+0x338` 을 본다:
 * ```
 * 1(CLR)                         → 밀기(8, 0, [장면+0x164] ? 3 : 4, 1000) → 142
 * 2(왼 끝) && [장면+0x164] == 0  → 밀기(8, 0, 4, 1000) → 142        ; 상대 팀에서 왼쪽으로 나간다
 * 3(오른 끝) && [장면+0x164] ≠ 0 → 밀기(8, 0, 3, 1000) → 142        ; 내 팀에서 오른쪽으로 나간다
 * ```
 * 시즌 0x7044 · 일반 0x2a370 과 같은 규칙이다(`leavesEntryEditor`). 저장은 따로 안 한다.
 * 그림 0x16738 = 기본 엔트리 목록 `0x5cfec` + 머리띠 `0x54d95(skin, 탭 1 ? 7 : 6, 탭 1 ? 0xf : 0x17, 0)` — 시즌 0xe0 과 같다.
 *
 * 국가대항전 두 팀은 저장의 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 상대국, `entities/career/model/nariCupTeams`)이다.
 * 화면 밀기(0xbdae9 종류 8)는 라우트가 `NariScreenPush` 로 건다.
 */
import { leavesEntryEditor, openEntryEditor, pointEntryCursor, pressEntryKey } from '@/entities/season-mode/model/entryEditor'
import type {
  EntryBatterRow, EntryEditorState, EntryKey, EntryLists, EntryPitcherRow,
} from '@/entities/season-mode/model/entryEditor'
import {
  MY_RECORD_SLOT, NO_RECORD_ACE, nariTeamRecordOf, nariTeamsOf, tableNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import { leagueGamePitchersOf, nextOpponentOf } from '@/entities/career/model/playerCareer'
import { nariCupRecordOf } from '@/entities/career/model/nariCupTeams'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceDetailSourceOf, staminaPercentOf, tableDetailSourceOf } from '@/entities/season-mode/model/seasonEntry'
import type { EntryBatterLine, EntryPitcherLine, PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import {
  leagueBatterIdOf, leagueBatterLineOf, leaguePitcherIdOf, leaguePitcherLineOf,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { BATTER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { humanGamePitcherStaminasOf } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'

/** 목록 한 줄이 보여 줄 것 (`widgets/entry-editor` 의 `EntryFace`) */
export interface NariEntryFace {
  readonly name: string
  /** '0' 상세 창 네 칸 — 타자 히트·파워·수비·주루 · 투수 제구·구속·변화·체력 */
  readonly ability: readonly number[]
  /**
   * 레코드 +0xb & 3 — 엔트리 목록 창의 보직 딱지 · 타자 이름 칸 세로 줄 색 (붙박이 표 행 · 마선수 표의 값).
   */
  readonly profileLow?: number
  /** 레코드 +0x20~ 시즌 줄 (`NariEntryCellSource`) */
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
  /** 체력 줄 — 용량 0x66e44(팀 레코드, rec, 0) · 퍼센트 0x572a4 */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
  /** '0' 상세 창 0x5b798 레코드 칸 — 붙박이 표 행 · 마선수 표. ⚠️ 내 선수 줄은 커리어가 레코드 칸(+0xb · +0x1b 등)을 안 들어 비운다 */
  readonly detailSource?: PlayerDetailSource
}

export interface NariEntryBatter extends EntryBatterRow, NariEntryFace {}
export interface NariEntryPitcher extends EntryPitcherRow, NariEntryFace {}
export type NariEntryLists = EntryLists<NariEntryBatter, NariEntryPitcher>

/** 143 한 번 — 편집기 상태와 그 명부 */
export interface NariEntryView {
  /** `[장면+0x164]` — 참이면 '4'/왼으로 들어온 내 팀, 거짓이면 '6'/오른으로 들어온 상대 팀 */
  readonly isMyTeam: boolean
  readonly teamId: number
  readonly editor: EntryEditorState
  readonly lists: NariEntryLists
}

/**
 * **기록 열 · 체력 줄 재료** — 진입 0x16af8 16c0c~16c24 가 [ed+0x333] = 1 · [ed+0x334] = [장면+0xcc](투수편 3 · 타자편 4) 를 세운다.
 * 3 · 4 는 0x572a4 의 {1, 2, 3, 4, 8, 9} 안이라 퍼센트 = trunc(레코드 +0x2c / 100).
 * 레코드는 0x1f9a9(저장, 모드, 팀) — 모드 3 0x1f940([저장+0xb8]) · 4 0x1f8f8([저장+0xbc]) 블록 + 4 + 0x1c·팀 의 나리 팀 레코드다.
 * 그 줄 +0x20~ 는 0x204e1 → 0x204e0/0xb6cc4 가 시즌 처음 0(+0x2c 10000)으로 두고 0xa8024 가 게이트 0xa56dc 모드 3 · 4 갈래(정규시즌)를
 * 지날 때 쌓은 것 — 웹은 커리어의 리그 기록표(`leaguePlayerStats`, 정규시즌만 쌓는다)가 같은 값이다. +0x2c 는 커리어의
 * `leaguePitcherStaminas`(142 가 g == 0 이면 10000 으로 채운다 — `humanGamePitcherStaminasOf`).
 * 사기 V[+2] — 투수편 내 팀은 커리어 사기(0x1f988(저장, R[1]) +2 와 같은 칸, `PitcherStatusBoard`). ⚠️ 미확인: 그 밖 팀 레코드 사기는
 * 웹이 안 들어 100 으로 둔다.
 * ⚠️ 미확인: 국가대항전 두 칸(+0xbc4 · +0xbe0)은 대회마다 새로 베끼는 레코드라 이 재료를 안 쓰고 비운다. 내 선수 줄(표 밖)도 비운다.
 */
export interface NariEntryCellSource {
  readonly stats: LeaguePlayerStats
  /** 그 팀 붙박이 표 칸별 +0x2c — 없으면 10000 */
  readonly staminas: readonly number[] | undefined
  /** [ed+0x334] = 모드 */
  readonly staminaMode: number
  readonly morale: number
}

const FULL_RECORD_STAMINA = 10000

function nariBatterCellsOf(cells: NariEntryCellSource | undefined, teamId: number, slot: number) {
  if (cells === undefined) return {}
  const line = leagueBatterLineOf(cells.stats, leagueBatterIdOf(teamId, slot))
  // ⚠️ 미확인: +0x2e(실책)는 웹 기록표에 없어 0
  const batterLine: EntryBatterLine = {
    atBats: line.atBats, hits: line.hits, doubles: line.doubles ?? 0, triples: line.triples ?? 0, homeRuns: line.homeRuns,
    runsBattedIn: line.runsBattedIn, steals: line.steals ?? 0, errors: 0,
  }
  return { batterLine }
}

function nariPitcherCellsOf(cells: NariEntryCellSource | undefined, teamId: number, slot: number, staminaAbility: number) {
  if (cells === undefined) return {}
  const line = leaguePitcherLineOf(cells.stats, leaguePitcherIdOf(teamId, slot))
  // ⚠️ 미확인: +0x2a(사사구)는 웹 기록표에 없어 0
  const pitcherLine: EntryPitcherLine = {
    outs: line.outs, runsAllowed: line.runsAllowed, saves: line.saves, strikeouts: line.strikeouts, pitches: line.pitches,
    walks: 0, wins: line.wins, losses: line.losses,
  }
  return {
    pitcherLine,
    stamina: {
      capacity: staminaCapacityOf(staminaAbility, cells.morale, false),
      percent: staminaPercentOf(cells.staminaMode, cells.staminas?.[slot] ?? FULL_RECORD_STAMINA),
    },
  }
}

/** 마선수 줄 — XlsACE 행을 통째 베낀 레코드(0xb521c · 0xb53f0): 줄은 표의 `recordLine`. ⚠️ 미확인: 마투수 +0x2c 는 가득으로 둔다 */
function aceCellsOf(cells: NariEntryCellSource | undefined, recordLine: readonly number[], isPitcher: boolean, staminaAbility: number) {
  if (cells === undefined) return {}
  if (!isPitcher) return { batterLine: entryBatterLineOfRecord(recordLine) }
  return {
    pitcherLine: entryPitcherLineOfRecord(recordLine),
    stamina: { capacity: staminaCapacityOf(staminaAbility, cells.morale, false), percent: staminaPercentOf(cells.staminaMode, FULL_RECORD_STAMINA) },
  }
}

const aceBatterFace = (index: number): NariEntryFace => {
  const ace = ACE_BATTERS[index]
  if (ace === undefined) return { name: '마타자', ability: [] }
  const ability = [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run]
  return { name: ace.name, ability, profileLow: ace.profile & 3, detailSource: aceDetailSourceOf(ace, index, ability, false) }
}

/** 마투수 표의 네 칸은 타자 칸 이름으로 들었다 — 제구·구속·변화·체력 차례 (`aceOpponent` 주석) */
export const acePitcherFace = (index: number): NariEntryFace => {
  const ace = ACE_PITCHERS[index]
  if (ace === undefined) return { name: '마투수', ability: [] }
  const ability = [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run]
  return { name: ace.name, ability, profileLow: ace.profile & 3, detailSource: aceDetailSourceOf(ace, index, ability, true) }
}

/**
 * 타자 탭 목록 — 레코드 타자 배열 차례 그대로(`0x55724` 가 `[팀+0x18]` 을 훑는다). 내 선수 줄은 `me`(타자편 커리어) 로,
 * 마타자 줄은 마선수 표로, 나머지는 그 팀 붙박이 표 행으로 채운다.
 */
export function nariEntryBattersOf(
  record: NariTeamRecord,
  teamId: number,
  me: NariEntryFace | null,
  cells?: NariEntryCellSource,
): NariEntryBatter[] {
  const table = teamBatters(teamId)
  return record.batters.map((row) => {
    if (row.ace !== undefined) {
      return { ...aceBatterFace(row.ace), ...aceCellsOf(cells, ACE_BATTERS[row.ace]?.recordLine ?? [], false, 0), isAce: true, position: row.position }
    }
    if (row.slot === MY_RECORD_SLOT) {
      return { ...(me ?? { name: '', ability: [] }), isAce: false, position: row.position }
    }
    const player = table[row.slot]
    return {
      name: player?.name ?? '', ability: player?.ability ?? [], isAce: false, position: row.position,
      ...(player === undefined ? {} : { profileLow: player.profile & 3, detailSource: tableDetailSourceOf(player, false, player.ability) }),
      ...(player === undefined ? {} : nariBatterCellsOf(cells, teamId, row.slot)),
    }
  })
}

/**
 * 투수 탭 목록 — 투수 배열 차례(붙박이 표 칸, 0번 = 오늘 선발). `special` 이 표 밖 칸(마투수 · 투수편 내 투수)을 채운다 —
 * 돌려준 값의 `isAce` 가 마선수 잠금이다.
 */
export function nariEntryPitchersOf(
  teamId: number,
  order: readonly number[],
  special: (slot: number) => (NariEntryFace & { readonly isAce: boolean }) | undefined = () => undefined,
  cells?: NariEntryCellSource,
  aceRecordLineOf: (slot: number) => readonly number[] | undefined = () => undefined,
): NariEntryPitcher[] {
  const table = teamPitchers(teamId)
  return order.map((slot) => {
    const found = special(slot)
    const aceLine = aceRecordLineOf(slot)
    if (found !== undefined && aceLine !== undefined) return { ...found, ...aceCellsOf(cells, aceLine, true, found.ability[3] ?? 0) }
    if (found !== undefined) return found
    const player = table[slot]
    return {
      name: player?.name ?? '', ability: player?.ability ?? [], isAce: false,
      ...(player === undefined ? {} : { profileLow: player.profile & 3, detailSource: tableDetailSourceOf(player, true, player.ability) }),
      ...(player === undefined ? {} : nariPitcherCellsOf(cells, teamId, slot, player.ability[3])),
    }
  })
}

/** 진입 0x16af8 — 보기 전용 편집기(셋째 인자 0), 투수 탭 · 커서 0 */
export function openNariEntryView(isMyTeam: boolean, teamId: number, lists: NariEntryLists): NariEntryView {
  return { isMyTeam, teamId, editor: openEntryEditor(false), lists }
}

/** 키 0x1457c — 편집기 0x55864 를 돌리고 끝 코드로 142 로 나가는지 본다 */
export function pressNariEntryKey(view: NariEntryView, key: EntryKey): { readonly view: NariEntryView; readonly leaves: boolean } {
  const outcome = pressEntryKey(view.editor, view.lists, key)
  const next = { ...view, editor: outcome.state, lists: outcome.lists }
  return { view: next, leaves: leavesEntryEditor(outcome.state.result, view.isMyTeam) }
}

/** 웹 전용 — 줄을 눌러 커서를 옮긴다 */
export function pointNariEntryCursor(view: NariEntryView, index: number): NariEntryView {
  return { ...view, editor: pointEntryCursor(view.editor, view.lists, index) }
}

/** 레코드 8번 칸 마투수를 투수 차례 끝(8번)에 — `0xb521c` 의 0x60 갈래 */
function withRecordAcePitcher(order: readonly number[], record: NariTeamRecord): readonly number[] {
  return record.acePitcher === NO_RECORD_ACE ? order : [...order, ACE_PITCHER_SLOT]
}

/** 표 밖 투수 칸 — 마투수 */
function recordAcePitcherSpecial(record: NariTeamRecord) {
  return (slot: number) =>
    slot === ACE_PITCHER_SLOT && record.acePitcher !== NO_RECORD_ACE
      ? { ...acePitcherFace(record.acePitcher), isAce: true }
      : undefined
}

/** 표 밖 투수 칸 — 마투수 레코드 줄 */
export function recordAcePitcherLineOf(record: NariTeamRecord) {
  return (slot: number) =>
    slot === ACE_PITCHER_SLOT && record.acePitcher !== NO_RECORD_ACE ? ACE_PITCHERS[record.acePitcher]?.recordLine ?? [] : undefined
}

/**
 * **타자편** 143 — 정규·포스트시즌은 저장의 나리 팀 레코드(`nariTeams`)와 142 진입이 돌린 투수 차례(`leagueGamePitchersOf` —
 * g ≠ 0 이면 0xb8c80 로 한 칸 돈 것 · 포스트시즌은 시리즈 이월), 국가대항전(`cup`)은 대회 레코드 두 칸이다.
 */
export function batterNariEntryViewOf(
  career: PlayerCareer,
  isMyTeam: boolean,
  cup?: { readonly myTeam: number; readonly opponent: number },
): NariEntryView {
  const me: NariEntryFace = {
    name: career.name,
    ability: [career.ability.hit, career.ability.power, career.ability.defense, career.ability.run],
  }
  if (cup !== undefined) {
    // 국가대항전 — 0x1f9a9 가 팀 10 은 대표팀 칸(+0xbc4, 내 선수가 낀), 그 밖은 상대국 칸(+0xbe0)을 준다. 투수는 142 가 돌린 그 칸 차례
    const teamId = isMyTeam ? cup.myTeam : cup.opponent
    const record = career.nariCupTeams === undefined
      ? tableNariTeamRecord(teamId)
      : nariCupRecordOf(career.nariCupTeams, teamId)
    return openNariEntryView(isMyTeam, teamId, {
      batters: nariEntryBattersOf(record, teamId, me),
      pitchers: nariEntryPitchersOf(teamId, record.pitchers ?? UNSHUFFLED_PITCHER_ORDER),
    })
  }
  const opponent = nextOpponentOf(career)
  const teamId = isMyTeam ? career.teamId : opponent
  const record = nariTeamRecordOf(nariTeamsOf(career), teamId)
  const pitchers = leagueGamePitchersOf(career, opponent)
  const cells: NariEntryCellSource = {
    stats: career.leaguePlayerStats,
    staminas: humanGamePitcherStaminasOf(career, leagueDayCounterOf(career), teamId),
    staminaMode: BATTER_EDITION_MODE,
    // ⚠️ 미확인: 타자편 팀 레코드 사기 V[+2] 를 웹이 안 들어 100
    morale: 100,
  }
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, me, cells),
    pitchers: nariEntryPitchersOf(
      teamId,
      withRecordAcePitcher(isMyTeam ? pitchers.ourOrder : pitchers.opponentOrder, record),
      recordAcePitcherSpecial(record),
      cells,
      recordAcePitcherLineOf(record),
    ),
  })
}
