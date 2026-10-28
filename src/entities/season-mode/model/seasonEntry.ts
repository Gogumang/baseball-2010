import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { ROTATION_SIZE, rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import { aceLevelOf, aceLevelSlotOf, aceRecordAbilityAtLevel } from '@/entities/mission/model/aceLevel'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { HALL_OF_FAME_FIRST_ID, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterLine, EntryBatterRow, EntryLists, EntryPitcherLine, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'

/**
 * **시즌 0xe0 엔트리 편집이 보는 명단** — 갱신 `0x63dc` · 키 `0x7044` · 그림 `0xb074` (직접 떴다).
 *
 * ## 어느 레코드를 고치는가 — 시즌 저장의 팀 레코드 그 자체
 * ```
 * 63f4  SR+0x12c(국가대항전) ? 0xb7614(L, 대회 날, 0/1) : SR[1]·0xb765c(L, SR[1])   ; 두 팀
 * 6462  this+0x120 ? 내 팀 : 상대 팀
 * 6472  팀레코드 = 0x1f9a9(저장, 모드 [this+0x15c], 팀)     ; 모드 2 → 표 0xcd7e0[1] = 0x1f9ba → 0x1f570(저장, 팀)
 * 64ae  0x5561c(ed, &팀레코드, this+0x120, this+0x120, 1)   ; 편집 가능 = this+0x120 (유저 팀만)
 * ```
 * `0x1f570(저장, 팀)` 은 **시즌 저장 안의 팀 레코드**(`[저장+0xb4] + 4 + 팀×0x1c`, 국가대항전 중이면 대한민국
 * `+0x918` · 상대국 `+0x934`)다. 경기용 팀 객체 `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` →
 * 같은 저장 레코드에서 읽으므로, **편집기가 바꾼 순서가 곧 그날 경기의 타순·선발이고 저장에 남아 다음 경기까지
 * 이어진다.** 나가는 키 `0x7044` 는 저장을 따로 쓰지 않는다 — 파일 쓰기는 0xdd 의 경기 시작(`0x22754`)이 한다.
 *
 * 웹에서 그 레코드에 해당하는 것이 시즌 세이브의 `roster`(`SeasonTeamRoster`, 선수영입·트레이드가 고치는 배열)다.
 *
 * ## 0xe0 에 들어올 때 이미 일어난 일 (0xdd 들어옴 `0x6548`)
 * - `0xb8768` 이 두 팀 레코드의 칸 번호를 첨자로 다시 매긴다(`0xb603c`) — 웹 `SeasonPlayer` 는 칸 번호를
 *   이름 찾는 열쇠로도 쓰므로 다시 매기지 않는다(표시용 칸 번호만 다르다).
 * - 정규·포스트시즌이면 내 팀에 고른 **마투수를 8번**(`0xb88c8`), **마타자를 9번**(`0xb8870`)에 넣는다
 *   (옛 8·9번은 맨 끝으로). 웹 명단 배열에는 안 넣고 편집기 목록에만 끼운다 — 마선수는 편집기에서 못 움직이니
 *   빼고 되돌려도 순서가 같다.
 * - `SR+0xb2 ≠ 0` 이면 두 팀 로테이션 `0xb8c80`(투수 0~3 한 칸 당김)을 돈다. 웹 세이브는 배열을 돌리지 않고
 *   돈 칸 수로 셈하므로(`pitcherRotation.rotationSlotOf`) **편집기에는 그만큼 돌린 모양을 보여 주고**,
 *   고친 결과는 다시 되돌려 적는다. 그러면 "투수 탭 0번 = 오늘 선발" 이 원본과 같고 다음 날 로테이션도
 *   고친 배열에서 이어진다. 시즌 세션은 이 칸 수 자리(`dayCounter`)에 날짜 g 대신 리그 투수 레코드 차례의 선발 칸
 *   (`useSeasonSession.seasonLeagueStarterSlotOf` — 지난 시즌·포스트시즌에서 이어진 차례)을 넣는다.
 *
 * ## 상대 팀 · 대회 레코드 (웹 저장 자리)
 * - 상대 팀(this+0x120 = 0)은 보기 전용이라 고칠 일이 없다. 상대 팀 레코드는 트레이드로 바뀐 CPU 팀이면 시즌 저장의
 *   `cpuRosters`, 아니면 붙박이 표다(`useSeasonSession.cpuRosterOf` — 팀 경기 `opponentEntryOrder` 도 같은 레코드).
 *   원본은 상대 팀에도 굴린 마선수(`0x66968`·`0x66994`)를 넣는다 — `useSeasonSession` 이 0xdd 진입에서 굴려
 *   경기 옵션 `opponentAces` 로 싣고, CPU 팀 목록에도 같은 값을 `acePitcherId`·`aceBatterId` 로 끼운다.
 * - 국가대항전의 대한민국 레코드(`+0x918`)는 대회 내내 이어진다 — 웹은 시즌 세이브의 `cupRoster` 에 둔다
 *   (`useSeasonSession`, 대회를 열 때 표에서 채우고 대회가 끝나면 비운다).
 */

/**
 * 엔트리 목록 창 칸의 재료 (`widgets/entry-editor` 의 0x5c984 열) — 레코드 +0xb & 3 · 시즌 줄 +0x20~ · 체력 줄.
 * 칸 값을 모르면(옛 사본 등) 그 칸을 비운다.
 */
export interface SeasonEntryCells {
  /** 레코드 `+0xb & 3` — 타자 내야 0 · 외야 1 · 2 (0x571d8 세로 줄 색) · 투수 보직 (0xb6ded → 0x545e8) */
  readonly profileLow?: number
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
  /** 체력 줄 — 용량 0x66e44(팀, rec, 0) · 퍼센트 (0x571d8) */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
  /** '0' 상세 창 0x5b798 이 읽는 레코드 칸 (`seasonDetailSourceOf`) */
  readonly detailSource?: PlayerDetailSource
}

const detailRepertoireOf = (repertoire: Pick<PitcherRepertoire, 'form' | 'magicId' | 'pitchMask'> | undefined) =>
  repertoire === undefined ? undefined : { form: repertoire.form, magicNumber: repertoire.magicId, pitchMask: repertoire.pitchMask }

/**
 * 명단 선수 레코드의 상세 창 칸 — 0xe0 그림 0xb074 → 0x5cfec(0x5c984) 끝 0x5cfc8 이 커서 줄 레코드를 0x5b798 에 넘긴다.
 * 붙박이 표 선수는 Xls 행(+0xb · +0x14 · +0x1b · 레퍼토리 `ROSTER_PITCHER_REPERTOIRES`, 같은 차례), 영입 사본은 옮긴 기록 칸.
 * 레코드 +0x18(필살)은 붙박이 표가 0 이고 타자 사본은 `specialNumber` 다.
 * 영입 사본의 +0x1b(연봉)는 나리 연봉 쓰기 0xa4fd8 가 둔 min(연봉 / 10, 255) 이다(`salaryGrade` — 나리 사본은 영입 때 커리어 연봉,
 * 명전 칸은 등록 때 연봉으로 센다). 그 칸이 없는 옛 사본 · 옛 명전 기록은 비운다. 명전 칸에서만 이름을 찾는 표 밖 선수(사본 없음)는 칸을 모른다.
 */
export function seasonDetailSourceOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  ability: readonly number[],
): PlayerDetailSource | undefined {
  const team = tableTeamOf(player, teamId)
  const table = player.id < HALL_OF_FAME_FIRST_ID ? (isPitcher ? teamPitchers(team) : teamBatters(team))[player.id] : undefined
  if (table !== undefined) return tableDetailSourceOf(table, isPitcher, ability)
  const record = player.record
  if (record === undefined) return undefined
  if ('repertoire' in record) {
    return {
      isPitcher,
      abilities: ability,
      aceIndex: -1,
      profile: record.profile ?? 0,
      skillBits: record.skillBits ?? 0,
      grade: record.salaryGrade ?? null,
      repertoire: detailRepertoireOf(record.repertoire),
    }
  }
  return {
    isPitcher,
    abilities: ability,
    aceIndex: -1,
    profile: record.profile ?? 0,
    skillBits: record.skillBits ?? 0,
    grade: record.salaryGrade ?? null,
    specialNumber: record.specialNumber ?? 0,
  }
}

/** 붙박이 표 행(Xls 0x30 바이트) 레코드의 상세 창 칸 — +0xb · +0x14 · +0x1b · 레퍼토리(`PITCHERS` 와 같은 차례) · +0x18 = 0 */
export function tableDetailSourceOf(table: RosterPlayer, isPitcher: boolean, ability: readonly number[]): PlayerDetailSource {
  return {
    isPitcher,
    abilities: ability,
    aceIndex: -1,
    profile: table.profile,
    skillBits: table.skillBits,
    grade: table.grade,
    ...(isPitcher ? { repertoire: detailRepertoireOf(ROSTER_PITCHER_REPERTOIRES[PITCHERS.indexOf(table)]) } : { specialNumber: 0 }),
  }
}

/** 마선수 줄 — XlsACE 행을 통째 베낀 레코드 (+0xb · +0x14 · 마투수 레퍼토리 `ACE_PITCHER_REPERTOIRES`) */
export function aceDetailSourceOf(ace: AcePlayer, aceIndex: number, ability: readonly number[], isPitcher: boolean): PlayerDetailSource {
  return {
    isPitcher,
    abilities: ability,
    aceIndex,
    profile: ace.profile,
    skillBits: ace.skillBits,
    grade: null,
    ...(isPitcher ? { repertoire: detailRepertoireOf(ACE_PITCHER_REPERTOIRES[aceIndex]) } : {}),
  }
}

/** 편집기 목록 한 줄 (타자) */
export interface SeasonEntryBatter extends EntryBatterRow, SeasonEntryCells {
  readonly name: string
  readonly ability: readonly number[]
  /** 시즌 명단 배열의 첨자 — 마선수는 명단 밖이라 −1 */
  readonly rosterIndex: number
}

/** 편집기 목록 한 줄 (투수) */
export interface SeasonEntryPitcher extends EntryPitcherRow, SeasonEntryCells {
  readonly name: string
  readonly ability: readonly number[]
  readonly rosterIndex: number
}

/** 레코드 +0x2c 가득 (Xls 투수 행 바이트 44~45 = 10000) */
const FULL_RECORD_STAMINA = 10000

/**
 * 칸 재료를 어디서 읽는가 — 엔트리 목록 창이 읽는 팀 레코드 칸.
 * - 시즌 줄: 일반모드 레코드는 Xls 행 그대로(행 바이트 32~43), 시즌 · 나리 저장 레코드는 0x204e0 이 비운 뒤 경기마다 쌓은 줄이라
 *   부르는 쪽이 `batterLineOf` · `pitcherLineOf` 로 준다. 안 주면 붙박이 표 칸의 Xls 줄, 표 밖 선수는 비운다.
 * - 체력 줄: S = [ed+0x334] ∈ {1, 2, 3, 4, 8, 9} ? trunc(+0x2c / 100) : 100 (0x572a4) · M = 0x66e44(팀, rec, 0) =
 *   사기 보정 체력 + 250 (`staminaCapacityOf(…, false)`), 체력 = 칸 능력치 [3] (0xb6415(rec, 3, 1)).
 */
export interface SeasonEntryCellSource {
  /** [ed+0x334] — 일반 0x2648c 는 모드 [메뉴+0x13c](1), 시즌 진입들은 2 */
  readonly staminaMode: number
  /** 팀 레코드 사기 (s16 +2) — 0x66e44 의 V[+2] */
  readonly teamMorale: number
  /** 레코드 +0x2c — 안 주면 명단의 `stamina` */
  readonly staminaOf?: (player: SeasonPlayer, index: number) => number
  readonly batterLineOf?: (player: SeasonPlayer) => EntryBatterLine
  readonly pitcherLineOf?: (player: SeasonPlayer) => EntryPitcherLine
}

/**
 * 일반모드(상태 23) — Xls 행 줄 · 스태미나 가득 · 모드 1 · 사기 100. 모드 1 의 팀 레코드(`0x1f9d2` → `0x1f874` = [g+0xb0]+0x5c8 칸)는
 * 경기정보 0x30f20 이 `0x1f8c0`(마스터)을 `0x21d30` → `0x1fe5c` 로 통째 복사한 것이고 +2 에 쓰는 곳이 없다(0xa3a44 는 모드 3·4 칸만,
 * 0x8e3dc 는 모드 2 만 — `teamGameFlow.ourTeamMoraleOf`) → XlsTEAM_DATA 표값 = 전 팀 100
 */
export const GENERAL_ENTRY_CELL_SOURCE: SeasonEntryCellSource = {
  staminaMode: 1,
  teamMorale: 100,
  staminaOf: () => FULL_RECORD_STAMINA,
}

/** 체력 줄 퍼센트 0x572a4 — [ed+0x334] ∈ {1, 2, 3, 4, 8, 9} 면 trunc(+0x2c / 100), 그 밖 100 */
export const staminaPercentOf = (mode: number, stamina: number) =>
  mode >= 0 && mode <= 9 && ((0x31e >> mode) & 1) === 1 ? Math.trunc(stamina / 100) : 100

/** 명단 선수 한 줄의 칸 재료 */
export function seasonEntryCellsOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
  ability: readonly number[],
  source: SeasonEntryCellSource,
): SeasonEntryCells {
  const team = tableTeamOf(player, teamId)
  const table = player.id < HALL_OF_FAME_FIRST_ID ? (isPitcher ? teamPitchers(team) : teamBatters(team))[player.id] : undefined
  const record = player.record
  const profile = table?.profile ?? record?.profile ?? (record !== undefined && 'role' in record ? record.role : undefined)
  const profileLow = profile === undefined ? undefined : profile & 3
  const detailSource = seasonDetailSourceOf(teamId, player, isPitcher, ability)
  const detail = detailSource === undefined ? {} : { detailSource }
  if (!isPitcher) {
    const batterLine = source.batterLineOf?.(player) ?? (table === undefined ? undefined : entryBatterLineOfRecord(table.recordLine))
    return { ...(profileLow === undefined ? {} : { profileLow }), ...(batterLine === undefined ? {} : { batterLine }), ...detail }
  }
  const pitcherLine = source.pitcherLineOf?.(player) ?? (table === undefined ? undefined : entryPitcherLineOfRecord(table.recordLine))
  const stamina = source.staminaOf?.(player, index) ?? player.stamina
  return {
    ...(profileLow === undefined ? {} : { profileLow }),
    ...(pitcherLine === undefined ? {} : { pitcherLine }),
    ...detail,
    stamina: {
      capacity: staminaCapacityOf(ability[3] ?? 0, source.teamMorale, false),
      percent: staminaPercentOf(source.staminaMode, stamina),
    },
  }
}

/** 마선수 줄 — XlsACE 행을 통째 베낀 레코드(0xb521c · 0xb53f0): +0xb 는 표의 `profile`, 줄은 표의 `recordLine` */
function aceCellsOf(
  ace: AcePlayer,
  aceIndex: number,
  ability: readonly number[],
  isPitcher: boolean,
  source: SeasonEntryCellSource,
  /** 레코드 +0x2c — 넣은 그때는 10000, 경기 · 하루 끝을 지난 레코드면 그 값 (`SeasonRecordAces.pitcherStamina`) */
  recordStamina: number = FULL_RECORD_STAMINA,
): SeasonEntryCells {
  const detailSource = aceDetailSourceOf(ace, aceIndex, ability, isPitcher)
  if (!isPitcher) return { profileLow: ace.profile & 3, batterLine: entryBatterLineOfRecord(ace.recordLine), detailSource }
  return {
    profileLow: ace.profile & 3,
    detailSource,
    pitcherLine: entryPitcherLineOfRecord(ace.recordLine),
    // 레코드 +0x2c = 10000 — 0xdd 진입 66da `0xb88c8` 이 저장의 마투수 레코드 `0x1f825(app, 번호)`(앱 데이터 +0xc64 + 번호×0x30,
    // 0x20094 6번 갈래가 XlsACE_PIT 행을 부은 것 — 다섯 줄 모두 0x2710)를 0xb521c 로 +0x2c 까지 통째 8번 칸에 넣는다(b5296~b529c).
    // 0x1f824 를 부르는 넷(0x48d50 · 0x5aefc · 0xaae7c · 0xb88c8)은 모두 베껴 가는 쪽이고, 0xe0 에서 돌아온 0xdd 는 다시 안 넣는다
    stamina: { capacity: staminaCapacityOf(ability[3] ?? 0, source.teamMorale, false), percent: staminaPercentOf(source.staminaMode, recordStamina) },
  }
}

export type SeasonEntryLists = EntryLists<SeasonEntryBatter, SeasonEntryPitcher>

/** 마투수가 들어가는 칸 (`0xb521c` 의 0x60 가지) · 마타자가 들어가는 칸 (`0xb53f0` 의 0x40 가지) */
const ACE_PITCHER_SLOT = 8
const ACE_BATTER_SLOT = 9
/** 시즌 레코드의 마투수 칸 · 마타자 칸 — 트레이드 요청 굴림(`tradeRequest`)이 같은 칸을 본다 */
export const SEASON_RECORD_ACE_PITCHER_SLOT = ACE_PITCHER_SLOT
export const SEASON_RECORD_ACE_BATTER_SLOT = ACE_BATTER_SLOT
const NOT_IN_ROSTER = -1

/** 붙박이 표의 한 팀을 시즌 명단 모양으로 — 칸 번호(`+0xa & 0x1f`)·id 는 표의 첨자, 수비 위치는 표의 값 */
export function tableRosterOf(teamId: number): SeasonTeamRoster {
  return {
    pitchers: teamPitchers(teamId).map((_player, slot) => ({ id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
    batters: teamBatters(teamId).map((player, slot) => ({
      id: slot,
      kindByte: slot,
      fieldPosition: player.position ?? 0,
      stamina: 0,
    })),
  }
}

/**
 * 시즌 명단 선수의 이름·능력치 — 리그 선수(id < 0xb4)는 그 선수의 붙박이 표 팀(`tableTeamOf` — 트레이드로 옮겨 온
 * 선수는 옛 팀) 표의 id 번째에서 빌려 온다. 영입해 온 나리·명예 선수는 기록 사본, 그것도 없으면 `투수 N번` 이다.
 *
 * **능력치는 레코드의 `0xb6415(rec, k, 1)`** 다 — 0xe0 그림 0xb074 → 목록 창 0x5cfec(0x5c984) 의 '0' 상세 창
 * `0x5b798(skin, 종류, 팀[+0x14 | +0x18] + 커서·0x30)`(0x5cf90~0x5cfc8, 투수 3 · 타자 2)이 능력치 도형
 * `0x5aefc(…, 레코드, …, 팀객체 0)` 을 부르고, 도형은 팀 객체가 0 이라 0xb570d 대신
 * `0xb6415(레코드, k, 1)`(0x5b234 · 투수 0x5b322) 를 칸 값으로, `0xb6415(레코드, k, 0)`(0x5b248 · 0x5b336) 를
 * 견줄 밑값으로 읽는다(0x5b5ba: 밑값과 같으면 보통 · 밑값이 크면 빨강 · 작으면 초록 글씨).
 * 그래서 붙박이 선수도 **밑값이 아니라 장비 니블(+0x19 · +0x1a — 시즌 명단 `equipment`, 없으면 표 행) · 장착 스킬(+0x14)을
 * 얹은 값**이고(`recordAbilityOf`), 영입 선수는 옮겨 온 0x30 바이트의 밑값 · +0x14 · 지금 니블로 다시 센다 — 영입 뒤 시즌
 * 장비 창이 니블을 바꾸면 그 값이 얹힌다. 밑값 칸이 없는 옛 기록 사본은 영입 때의 `0xb6414(…, 1)` 값 그대로다.
 */
export function playerFaceOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
): { readonly name: string; readonly ability: readonly number[] } {
  const team = tableTeamOf(player, teamId)
  const table = isPitcher ? teamPitchers(team) : teamBatters(team)
  const found = player.id < HALL_OF_FAME_FIRST_ID ? table[player.id] : undefined
  if (found !== undefined) {
    const equipment = player.equipment ?? found.equipment
    return { name: found.name, ability: recordAbilityOf({ ability: found.ability, skillBits: found.skillBits, equipment }, isPitcher) }
  }
  // 영입 때 옮긴 기록 사본(나리 선수)은 그 이름(rec + 1)·0x30 바이트로
  const record = player.record
  if (record !== undefined) {
    if (record.baseAbility === undefined) return { name: record.name, ability: record.ability }
    const equipment = player.equipment ?? record.equipment ?? []
    return {
      name: record.name,
      ability: recordAbilityOf({ ability: record.baseAbility, skillBits: record.skillBits ?? 0, equipment }, isPitcher),
    }
  }
  return { name: `${isPitcher ? '투수' : '타자'} ${index + 1}번`, ability: [] }
}

/** 마선수를 칸에 앉힌다 — 옛 칸 선수는 맨 끝으로 (`b527e` · `b544a`). 칸이 비어 있으면 그 자리에 덧붙는다 */
export function seatAce<T>(rows: readonly T[], slot: number, ace: T): T[] {
  const next = [...rows]
  const seated = next[slot]
  if (seated !== undefined) next.push(seated)
  if (slot > next.length) return [...next, ace]
  next[slot] = ace
  return next
}

/** g 번 로테이션(`0xb5ca8`: 0~3 한 칸 당김)을 돈 모양 — `view[i] = base[(i + g) % 4]` */
export function rotatedPitchersOf<T>(pitchers: readonly T[], dayCounter: number): T[] {
  const next = [...pitchers]
  if (pitchers.length < ROTATION_SIZE) return next
  const shift = rotationSlotOf(dayCounter)
  for (let i = 0; i < ROTATION_SIZE; i += 1) next[i] = pitchers[(i + shift) % ROTATION_SIZE] as T
  return next
}

/** `rotatedPitchersOf` 를 되돌린다 */
export function unrotatedPitchersOf<T>(view: readonly T[], dayCounter: number): T[] {
  const next = [...view]
  if (view.length < ROTATION_SIZE) return next
  const shift = rotationSlotOf(dayCounter)
  for (let i = 0; i < ROTATION_SIZE; i += 1) next[(i + shift) % ROTATION_SIZE] = view[i] as T
  return next
}

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

/**
 * 마선수 줄의 칸 값 — 0xe0 상세 창 도형이 다른 줄과 같이 `0xb6415(레코드, k, 1)` 을 읽는다(`playerFaceOf` 주석). 마선수 레코드는
 * 0xb521c · 0xb53f0 이 XlsACE 행을 통째 베낀 것이라 레벨 배율 → 장비 니블(모두 0) → 장착 스킬(+0x14) 단계를 먹는다
 * (`aceRecordAbilityAtLevel`)
 */
function aceFaceAbilityOf(ace: AcePlayer, order: number, levels: Readonly<Record<number, number>> | undefined): readonly number[] {
  const { hit, power, defense, run } = aceRecordAbilityAtLevel(ace, aceLevelOf(levels, aceLevelSlotOf(ace.role, order + 1)))
  return [hit, power, defense, run]
}

/** 0xe0 에 들어왔을 때 편집기 목록 — 로테이션을 돈 투수 배열과 마선수 두 칸을 끼운 모양 */
export function seasonEntryListsOf(input: SeasonEntryInput): SeasonEntryLists {
  const { teamId, roster, dayCounter } = input
  const cells = input.cells ?? GENERAL_ENTRY_CELL_SOURCE
  let batters: SeasonEntryBatter[] = roster.batters.map((player, index) => {
    const face = playerFaceOf(teamId, player, false, index)
    return {
      ...face,
      ...seasonEntryCellsOf(teamId, player, false, index, face.ability, cells),
      isAce: false,
      position: player.fieldPosition & 0xf,
      rosterIndex: index,
    }
  })
  let pitchers: SeasonEntryPitcher[] = rotatedPitchersOf(
    roster.pitchers.map((player, index) => {
      const face = playerFaceOf(teamId, player, true, index)
      return { ...face, ...seasonEntryCellsOf(teamId, player, true, index, face.ability, cells), isAce: false, rosterIndex: index }
    }),
    dayCounter,
  )
  const acePitcher = ACE_PITCHERS[input.acePitcherId]
  if (acePitcher !== undefined) {
    const ability = aceFaceAbilityOf(acePitcher, input.acePitcherId, input.aceLevels)
    pitchers = seatAce(pitchers, ACE_PITCHER_SLOT, {
      name: acePitcher.name,
      ability,
      ...aceCellsOf(acePitcher, input.acePitcherId, ability, true, cells),
      isAce: true,
      rosterIndex: NOT_IN_ROSTER,
    })
  }
  const aceBatter = ACE_BATTERS[input.aceBatterId]
  if (aceBatter !== undefined) {
    const ability = aceFaceAbilityOf(aceBatter, input.aceBatterId, input.aceLevels)
    batters = seatAce(batters, ACE_BATTER_SLOT, {
      name: aceBatter.name,
      ability,
      ...aceCellsOf(aceBatter, input.aceBatterId, ability, false, cells),
      isAce: true,
      position: 0,
      rosterIndex: NOT_IN_ROSTER,
    })
  }
  return { batters, pitchers }
}

/**
 * **시즌 팀 레코드에 남은 마선수** (U-105 r154 — 직접 떴다). 0xdd 진입 0x6548(66da · 66e6 내 팀 · 66f8 · 670a 상대)과 CPU 끼리 경기 준비
 * 0xc239c(c24aa~c24ee)의 `0xb88c8` · `0xb8870` 은 모드 2 에서 `0xb8680`(점프표 0xd8a30[1] = 0xb869e → b8724 `0x1f571(저장, 팀+0x25)`)
 * 으로 **시즌 저장의 팀 레코드 자체**에 넣는다 — 마투수 `0xb521c` 0x60 갈래(b5244~b529c: 수 > 8 이고 8번이 마선수면 덮기, 아니면
 * 0xb4e34(T, 1) 로 한 칸 늘려 8번을 맨 끝으로 베끼고 8번에) · 마타자 `0xb53f0` 0x40 갈래(b5418~b5470: 9번 같은 규칙). 빼는 곳은
 * `0xb512c`(b512c~b51e6: 수 > 8 · 9 이고 8 · 9번이 0xb633d 마선수면 맨 끝 줄을 그 칸에 베끼고 끝 줄 memset 0 · 수 −1) 하나이고,
 * 그것을 부르는 곳은 0xdf 진입 0x5980(5988~599e) · 0xe5 진입 0x5cd0(5cd8~5cee) 둘뿐이다 — 둘 다 열 팀 모두(i = 0..9 `0x1f571`).
 * 그래서 경기 뒤 그 둘을 지나기 전까지 레코드에 마선수 줄이 남는다(경기 끝 0x4ea0c 의 0x22755 로 파일에도 든다).
 * 웹 명단 배열(`roster` · `cpuRosters`)에는 넣지 않고 팀마다 무엇이 남았는지만 든다(`SeasonSave.recordAces`).
 */
export interface SeasonRecordAces {
  /** 8번 칸 마투수 0..4 (`ACE_PITCHERS`) — 없으면 −1 */
  readonly pitcher: number
  /** 9번 칸 마타자 0..4 (`ACE_BATTERS`) — 없으면 −1 */
  readonly batter: number
  /** 마투수 레코드 +0x2c — 경기 끝 값에 하루 끝 4f2bc `0xb617c`(+20%)를 먹인 것. 없으면 10000 */
  readonly pitcherStamina?: number
}

/**
 * 레코드에 마선수를 앉힌 배열의 칸 → 앉히기 전 줄 번호 (마선수 칸은 `'ace'`). 마선수가 없으면(`ace` < 0) 그대로다.
 * 예: 투수 8줄 · 8번 → [0..7, 'ace'] · 타자 12줄 · 9번 → [0..8, 'ace', 10, 11, 9]
 */
export function recordAceSeatOf(length: number, ace: number, slot: number): readonly (number | 'ace')[] {
  const rows: (number | 'ace')[] = Array.from({ length }, (_, index) => index)
  return ace < 0 ? rows : seatAce<number | 'ace'>(rows, slot, 'ace')
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
  const faceOf = (player: SeasonPlayer, isPitcher: boolean, index: number) => {
    const face = playerFaceOf(teamId, player, isPitcher, index)
    const name = nameOf?.(player, isPitcher, index)
    return name === undefined ? face : { ...face, name }
  }
  let batters = roster.batters.map((player, index): SeasonEntryBatter => {
    const face = faceOf(player, false, index)
    return {
      ...face,
      ...seasonEntryCellsOf(teamId, player, false, index, face.ability, cells),
      isAce: false,
      position: player.fieldPosition & 0xf,
      rosterIndex: index,
    }
  })
  let pitchers = roster.pitchers.map((player, index): SeasonEntryPitcher => {
    const face = faceOf(player, true, index)
    return { ...face, ...seasonEntryCellsOf(teamId, player, true, index, face.ability, cells), isAce: false, rosterIndex: index }
  })
  const acePitcher = recordAces === undefined ? undefined : ACE_PITCHERS[recordAces.pitcher]
  if (recordAces !== undefined && acePitcher !== undefined) {
    const ability = aceFaceAbilityOf(acePitcher, recordAces.pitcher, aceLevels)
    pitchers = seatAce(pitchers, ACE_PITCHER_SLOT, {
      name: acePitcher.name,
      ability,
      ...aceCellsOf(acePitcher, recordAces.pitcher, ability, true, cells, recordAces.pitcherStamina),
      isAce: true,
      rosterIndex: NOT_IN_ROSTER,
    })
  }
  const aceBatter = recordAces === undefined ? undefined : ACE_BATTERS[recordAces.batter]
  if (recordAces !== undefined && aceBatter !== undefined) {
    const ability = aceFaceAbilityOf(aceBatter, recordAces.batter, aceLevels)
    batters = seatAce(batters, ACE_BATTER_SLOT, {
      name: aceBatter.name,
      ability,
      ...aceCellsOf(aceBatter, recordAces.batter, ability, false, cells),
      isAce: true,
      position: 0,
      rosterIndex: NOT_IN_ROSTER,
    })
  }
  return { batters, pitchers }
}

/** 시즌 진입들의 [ed+0x333] = 1 · [ed+0x334] = 2 — 칸 재료를 따로 안 줄 때 */
export const SEASON_ENTRY_CELL_SOURCE: SeasonEntryCellSource = { staminaMode: 2, teamMorale: 100 }

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

/**
 * **팀 경기에 넘길 내 팀 명단 순서** — 팀 경기 옵션 `ourEntryOrder`(`teamGameRoster.TeamEntryOrder`)로 받는다.
 *
 * 받는 쪽은 타자 명단을 이 순서(로스터 칸 + 수비 위치)로, 투수 명단도 이 순서로 세우고 **선발 칸은
 * `rotationSlotOf(dayCounter)`** 를 쓴다 — 원본의 "g 번 돈 배열의 0번" 과 같다.
 *
 * 영입 선수(id ≥ 0xb4 · 0xfe)는 붙박이 표에 없다. 원본 경기용 팀 0xb891c 는 팀 레코드의 0x30 바이트를 id 로 거르지 않고
 * 그대로 쓰고(0xb8680), 이름은 0xaa458 표 밖이라 rec + 1, 능력치는 그 기록의 0xb6414 다 (7da5044) — 그래서
 * 선수가 영입 때 옮긴 기록 사본(`SeasonPlayer.record` — 나리 선수)을 들고 있으면 그것을, 아니면 `recordOf` 가 주는
 * 기록(명전 칸)을 그 칸에 싣는다. 둘 다 없으면 `rosterSlot` −1 (받는 쪽이 안 쓴 표 칸으로 채운다 — 근사).
 */
export interface SeasonEntryBatterRecord {
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 원본 id(+0) — 명단 차례에 실을 때 붙인다. 팀 경기가 그 선수의 시즌 기록을 표 밖 줄로 쌓는다 */
  readonly recordId?: number
  /** +0xb — 타입(비트5~7) · 손(비트4) · 피부(비트2~3) · 내외야(비트0~1) (`seasonRecordProfileOf`). 옛 사본엔 없다 */
  readonly profile?: number
  /** +0x18 — 고른 필살타법 번호 (0 안 고름). 옛 사본엔 없다 */
  readonly specialNumber?: number
  /** +0xc 네 칸 — `0xb6415(기록, k, 0)` 밑값 (장비·스킬 전). 옛 사본엔 없다 (`SeasonEntryRecordParts`) */
  readonly baseAbility?: readonly [number, number, number, number]
  /** +0x14 장착 스킬 비트. 옛 사본엔 없다 */
  readonly skillBits?: number
  /** +0x19 · +0x1a 장비 니블 네 칸 — 영입 0xc554 가 옮긴 기록의 니블. 옛 사본엔 없다 */
  readonly equipment?: readonly number[]
  /** +0x1b — 나리 연봉 쓰기 0xa4fd8 가 둔 min(연봉 / 10, 255) (`nariRecordSalaryGradeOf`). 옛 사본엔 없다 */
  readonly salaryGrade?: number
}

/**
 * 기록 사본의 0x30 바이트 중 `0xb6414` 를 다시 셈하는 칸 — 밑값 +0xc · 장착 스킬 +0x14 · 장비 니블 +0x19/+0x1a.
 *
 * 영입 0xc554 는 기록 0x30 바이트를 통째로 팀 레코드에 옮기고, 시즌 장비 창(0xdc → 적용 0x7d90)은 그 팀 레코드의 +0x19 · +0x1a 에
 * 니블을 쓴다. 경기용 팀 0xb891c → 0xb8680 은 그 레코드를 읽어 `0xb6414(기록, k, 1)` = 밑값 + 니블 보너스 + 장착 스킬을 **경기마다**
 * 셈한다 — 그래서 시즌에 산 장비가 영입 선수에게도 얹힌다. 세 칸이 있으면 `seasonRecordAbilityOf` 가 그렇게 셈하고, 없는 옛 사본은
 * 영입 때 남긴 `ability`(그때의 0xb6414)를 그대로 쓴다.
 */
export type SeasonEntryRecordParts = Pick<SeasonEntryBatterRecord, 'ability' | 'baseAbility' | 'skillBits' | 'equipment'>

/**
 * 기록으로 선 선수의 경기 능력치 `0xb6414(기록, k, 1)` — 니블은 시즌 명단 값(`SeasonPlayer.equipment` — 장비 창이 쓴 것),
 * 없으면 영입 때 옮긴 기록의 니블. 밑값이 없는 옛 사본은 `ability` 그대로.
 */
export function seasonRecordAbilityOf(
  record: SeasonEntryRecordParts,
  rosterEquipment: readonly number[] | undefined,
  isPitcher: boolean,
): readonly [number, number, number, number] {
  if (record.baseAbility === undefined) return record.ability
  return recordAbilityOf(
    { ability: record.baseAbility, skillBits: record.skillBits ?? 0, equipment: rosterEquipment ?? record.equipment ?? [] },
    isPitcher,
  )
}

/**
 * 기록 +0xb 한 바이트 — 등록(타자 0x16f28 · 투수 0x16f9a)이 쓴 그대로: `타입 << 5 | 손 << 4 | 피부 << 2 | 아랫 2비트`.
 * 아랫 2비트는 타자 내야 0 · 외야 1, 투수 보직(0xb6dec). 카드 정보 칸 0x7c450 이 이 비트로 타입·손·피부·보직을 읽는다.
 */
export function seasonRecordProfileOf(typeIndex: number, handIndex: number, skinIndex: number, low: number): number {
  return ((typeIndex & 7) << 5) | ((handIndex & 1) << 4) | ((skinIndex & 3) << 2) | (low & 3)
}

export interface SeasonEntryPitcherRecord {
  readonly name: string
  /** 제구 · 구속 · 변화 · 체력 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 이름 · 폼 0xb6e24 · 고른 마구 +0x18(`magicId` — 경기가 마구 번호로 쓴다) · 구질 마스크 +0x1c */
  readonly repertoire: { readonly name: string; readonly form: number; readonly magicId: number; readonly pitchMask: number }
  /** 보직 `+0xb & 3` (0xb6dec) — 없으면 받는 쪽(CPU 투수 교체)이 선발로 본다 */
  readonly role?: PitcherRole
  /** 원본 id(+0) — `SeasonEntryBatterRecord.recordId` 와 같다 */
  readonly recordId?: number
  /** +0xb 한 바이트 (`seasonRecordProfileOf`, 아랫 2비트 = `role`). 옛 사본엔 없다 */
  readonly profile?: number
  /** +0xc 네 칸 밑값 · +0x14 · +0x19/+0x1a — `SeasonEntryBatterRecord` 의 같은 칸 (`SeasonEntryRecordParts`) */
  readonly baseAbility?: readonly [number, number, number, number]
  readonly skillBits?: number
  readonly equipment?: readonly number[]
  /** +0x1b — `SeasonEntryBatterRecord.salaryGrade` 와 같다 */
  readonly salaryGrade?: number
}

/** 표 밖 선수의 기록을 찾아 준다 — 없으면 undefined */
export interface SeasonEntryRecordSource {
  readonly batter: (player: SeasonPlayer) => SeasonEntryBatterRecord | undefined
  readonly pitcher: (player: SeasonPlayer) => SeasonEntryPitcherRecord | undefined
}

export interface SeasonEntryOrder {
  readonly batters: readonly {
    readonly rosterSlot: number
    readonly position: number
    readonly record?: SeasonEntryBatterRecord
    /** `rosterSlot` 의 붙박이 표 팀 — 트레이드로 옮겨 온 선수만 (`SeasonPlayer.tableTeamId`) */
    readonly tableTeamId?: number
    /** 레코드 장비 니블 네 칸 — 저장 명단에 있을 때만 (`SeasonPlayer.equipment`, 경기가 0xb6414 보너스로 먹는다) */
    readonly equipment?: readonly number[]
  }[]
  /** 로스터 칸, 표 밖 선수의 기록, 또는 다른 팀 표 자리(트레이드로 옮겨 온 투수) */
  readonly pitchers: readonly (number | SeasonEntryPitcherRecord | SeasonEntryTablePitcher)[]
}

/** 붙박이 표 자리의 투수 — 트레이드로 옮겨 온 투수, 또는 장비 니블을 든 제 팀 투수(`tableTeamId` 없음 = 그 팀) */
export interface SeasonEntryTablePitcher {
  readonly tableTeamId?: number
  readonly tableSlot: number
  /** 레코드 장비 니블 네 칸 (`SeasonPlayer.equipment`) */
  readonly equipment?: readonly number[]
}

/**
 * 기록으로 선 선수의 지금 레코드 니블 — 시즌 장비 창(0xdc → 0x7d90)이 쓴 시즌 명단 값, 없으면 영입 0xc554 가 옮긴 기록 사본의 니블.
 * 둘 다 없으면(니블 칸이 생기기 전의 옛 사본) 싣지 않는다 — 맨몸으로 그린다.
 * ⚠️ 이사 못 함: 1514e8c 앞에 영입한 나리 사본은 영입 순간의 니블을 남기지 않았고 지금 나리 저장은 그 뒤에 바뀌었을 수 있어
 *    되찾을 길이 없다(지어내지 않는다). 니블 없는 옛 명전 기록도 같다
 */
function recordNibblesOf(player: SeasonPlayer, record: Pick<SeasonEntryBatterRecord, 'equipment'>): { readonly equipment?: readonly number[] } {
  const equipment = player.equipment ?? record.equipment
  return equipment === undefined ? {} : { equipment }
}

export function seasonEntryOrderOf(roster: SeasonTeamRoster, recordOf?: SeasonEntryRecordSource): SeasonEntryOrder {
  const isTablePlayer = (player: SeasonPlayer) => player.id < HALL_OF_FAME_FIRST_ID
  return {
    batters: roster.batters.map((player) => {
      const position = player.fieldPosition & 0xf
      if (isTablePlayer(player)) {
        // 장비 니블(+0x19 · +0x1a)은 레코드에 있어 경기의 0xb6414 가 먹는다 — 저장 명단에 있을 때만 싣는다(없으면 표 행 값)
        return {
          rosterSlot: player.id,
          position,
          ...(player.tableTeamId === undefined ? {} : { tableTeamId: player.tableTeamId }),
          ...(player.equipment === undefined ? {} : { equipment: player.equipment }),
        }
      }
      const record = player.record ?? recordOf?.batter(player)
      // 원본 id 를 함께 실어 그 선수의 시즌 기록을 제 줄(리그 기록표의 표 밖 줄)로 쌓게 한다.
      // 능력치는 그 기록의 0xb6414 를 지금 니블로 다시 셈한다 — 시즌 장비 창이 산 장비가 얹힌다 (`seasonRecordAbilityOf`)
      return record === undefined
        ? { rosterSlot: NOT_IN_ROSTER, position }
        : {
            rosterSlot: NOT_IN_ROSTER,
            position,
            record: {
              name: record.name,
              ability: seasonRecordAbilityOf(record, player.equipment, false),
              recordId: player.id,
              // +0x1b(연봉 칸) — 팀 경기 교체 창의 상세 창 0x5b798 이 5c87c~5c884 로 연봉을 찍는다(옛 사본엔 없다)
              ...(record.salaryGrade === undefined ? {} : { salaryGrade: record.salaryGrade }),
              // 장착 비트(+0x14) — 간이 타석 0xab214 의 스킬 판정이 본다(옛 사본은 없다)
              ...(record.skillBits === undefined ? {} : { skillBits: record.skillBits }),
              // 니블 +0x19 · +0x1a(타석 그림 장비 겹 0x78fd8) · +0xb(폼 · 피부 · 손) — 영입 0xc554 가 통째로 옮긴 0x30 바이트의 칸
              ...recordNibblesOf(player, record),
              ...(record.profile === undefined ? {} : { profile: record.profile }),
            },
          }
    }),
    pitchers: roster.pitchers.map((player) => {
      if (isTablePlayer(player)) {
        if (player.tableTeamId === undefined && player.equipment === undefined) return player.id
        return {
          ...(player.tableTeamId === undefined ? {} : { tableTeamId: player.tableTeamId }),
          tableSlot: player.id,
          ...(player.equipment === undefined ? {} : { equipment: player.equipment }),
        }
      }
      const carried = player.record
      const record = carried !== undefined && 'repertoire' in carried ? carried : recordOf?.pitcher(player)
      if (record === undefined) return NOT_IN_ROSTER
      // 0xb6414 를 지금 니블로 다시 셈한다(`seasonRecordAbilityOf`). 장착 비트(+0x14)도 실어 경기의 스킬 판정이 본다.
      // 니블(+0x19 · +0x1a)은 마운드 그림 장비 겹(타석 교대 0x47cc8 48138~4816a → 0x79790)이 고른다
      const { baseAbility: _base, equipment: _equipment, ...rest } = record
      return {
        ...rest,
        ability: seasonRecordAbilityOf(record, player.equipment, true),
        recordId: player.id,
        ...recordNibblesOf(player, record),
      }
    }),
  }
}

/*
 * **트레이드로 옮겨 온 리그 선수**(`tableTeamId` 가 선 선수) — 원본 경기용 팀 0xb891c 는 팀 레코드의 0x30 바이트를 그대로
 * 쓰므로(0xb8680) 그 선수는 옛 팀 Xls 행 사본(이름 0xaa458 표의 제 id · 능력치 0xb6414 · 구질 · 보직 +0xb)으로 서고, 기록 함수
 * 0xa8024 는 그 레코드 +0x20~ 에 쌓아 성적이 선수를 따라간다. 그래서 명단 차례에 **표 팀 + 칸**(`tableTeamId` · id)을 실어
 * 넘긴다 — 팀 경기가 그 표 행으로 세우고 리그 기록표도 그 자리(`leagueBatterIdOf(옛 팀, id)`)로 쌓는다.
 */
