import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { ROTATION_SIZE, rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { HALL_OF_FAME_FIRST_ID } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor'

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
 * ⚠️ 미해결·근사
 * - 상대 팀(this+0x120 = 0)은 보기 전용이라 고칠 일이 없다. 웹은 상대 팀 명단을 붙박이 표에서 만든다.
 *   원본은 상대 팀에도 굴린 마선수(`0x66968`·`0x66994`)를 넣는다 — `useSeasonSession` 이 0xdd 진입에서 굴려
 *   경기 옵션 `opponentAces` 로 싣고, CPU 팀 목록에도 같은 값을 `acePitcherId`·`aceBatterId` 로 끼운다.
 * - 국가대항전의 대한민국 레코드(`+0x918`)는 대회 내내 이어진다 — 웹은 시즌 세이브의 `cupRoster` 에 둔다
 *   (`useSeasonSession`, 대회를 열 때 표에서 채우고 대회가 끝나면 비운다).
 */

/** 편집기 목록 한 줄 (타자) */
export interface SeasonEntryBatter extends EntryBatterRow {
  readonly name: string
  readonly ability: readonly number[]
  /** 시즌 명단 배열의 첨자 — 마선수는 명단 밖이라 −1 */
  readonly rosterIndex: number
}

/** 편집기 목록 한 줄 (투수) */
export interface SeasonEntryPitcher extends EntryPitcherRow {
  readonly name: string
  readonly ability: readonly number[]
  readonly rosterIndex: number
}

export type SeasonEntryLists = EntryLists<SeasonEntryBatter, SeasonEntryPitcher>

/** 마투수가 들어가는 칸 (`0xb521c` 의 0x60 가지) · 마타자가 들어가는 칸 (`0xb53f0` 의 0x40 가지) */
const ACE_PITCHER_SLOT = 8
const ACE_BATTER_SLOT = 9
const NOT_IN_ROSTER = -1

/** 붙박이 표의 한 팀을 시즌 명단 모양으로 — 칸 번호(`+0xa & 0x1f`)·id 는 표의 첨자, 수비 위치는 표의 값 */
export function tableRosterOf(teamId: number): SeasonTeamRoster {
  return {
    pitchers: teamPitchers(teamId).map((_player, slot) => ({ id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
    batters: teamBatters(teamId).map((player, slot) => ({
      id: slot, kindByte: slot, fieldPosition: player.position ?? 0, stamina: 0,
    })),
  }
}

/**
 * 시즌 명단 선수의 이름·능력치 — 리그 선수(id < 0xb4)는 그 팀 붙박이 표의 id 번째에서 빌려 온다.
 * 영입해 온 나리·명예 선수는 표에 없어 `투수 N번` 으로 적는다 (트레이드·영입 화면과 같은 한계).
 */
function playerFaceOf(
  teamId: number,
  player: SeasonPlayer,
  isPitcher: boolean,
  index: number,
): { readonly name: string; readonly ability: readonly number[] } {
  const table = isPitcher ? teamPitchers(teamId) : teamBatters(teamId)
  const found = player.id < HALL_OF_FAME_FIRST_ID ? table[player.id] : undefined
  if (found !== undefined) return { name: found.name, ability: found.ability }
  return { name: `${isPitcher ? '투수' : '타자'} ${index + 1}번`, ability: [] }
}

/** 마선수를 칸에 앉힌다 — 옛 칸 선수는 맨 끝으로 (`b527e` · `b544a`). 칸이 비어 있으면 그 자리에 덧붙는다 */
function seatAce<T>(rows: readonly T[], slot: number, ace: T): T[] {
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
}

/** 0xe0 에 들어왔을 때 편집기 목록 — 로테이션을 돈 투수 배열과 마선수 두 칸을 끼운 모양 */
export function seasonEntryListsOf(input: SeasonEntryInput): SeasonEntryLists {
  const { teamId, roster, dayCounter } = input
  let batters: SeasonEntryBatter[] = roster.batters.map((player, index) => ({
    ...playerFaceOf(teamId, player, false, index),
    isAce: false,
    position: player.fieldPosition & 0xf,
    rosterIndex: index,
  }))
  let pitchers: SeasonEntryPitcher[] = rotatedPitchersOf(
    roster.pitchers.map((player, index) => ({
      ...playerFaceOf(teamId, player, true, index),
      isAce: false,
      rosterIndex: index,
    })),
    dayCounter,
  )
  const acePitcher = ACE_PITCHERS[input.acePitcherId]
  if (acePitcher !== undefined) {
    const { hit, power, defense, run } = acePitcher.ability
    pitchers = seatAce(pitchers, ACE_PITCHER_SLOT, {
      name: acePitcher.name, ability: [hit, power, defense, run], isAce: true, rosterIndex: NOT_IN_ROSTER,
    })
  }
  const aceBatter = ACE_BATTERS[input.aceBatterId]
  if (aceBatter !== undefined) {
    const { hit, power, defense, run } = aceBatter.ability
    batters = seatAce(batters, ACE_BATTER_SLOT, {
      name: aceBatter.name, ability: [hit, power, defense, run], isAce: true, position: 0, rosterIndex: NOT_IN_ROSTER,
    })
  }
  return { batters, pitchers }
}

/**
 * 고친 편집기 목록을 시즌 명단으로 되적는다 — 마선수 줄을 빼고(움직일 수 없으니 남은 순서가 곧 명단 순서다)
 * 투수는 로테이션을 되돌린다. 타자는 편집기가 고친 수비 위치를 `+0x1c` 에 적는다.
 */
export function seasonRosterOfEntry(
  roster: SeasonTeamRoster,
  lists: SeasonEntryLists,
  dayCounter: number,
): SeasonTeamRoster {
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
 * `rotationSlotOf(dayCounter)`** 를 쓴다 — 원본의 "g 번 돈 배열의 0번" 과 같다. 영입 선수(id ≥ 0xb4 · 0xfe)는
 * 표에 없어 `rosterSlot` 이 −1 이다 (받는 쪽이 안 쓴 표 칸으로 채운다 — 근사).
 */
export interface SeasonEntryOrder {
  readonly batters: readonly { readonly rosterSlot: number; readonly position: number }[]
  readonly pitchers: readonly number[]
}

export function seasonEntryOrderOf(roster: SeasonTeamRoster): SeasonEntryOrder {
  const slotOfPlayer = (player: SeasonPlayer) => (player.id < HALL_OF_FAME_FIRST_ID ? player.id : NOT_IN_ROSTER)
  return {
    batters: roster.batters.map((player) => ({ rosterSlot: slotOfPlayer(player), position: player.fieldPosition & 0xf })),
    pitchers: roster.pitchers.map(slotOfPlayer),
  }
}
