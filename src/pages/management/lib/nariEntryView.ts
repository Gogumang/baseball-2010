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
 * ⚠️ 근사·미해결: 화면 밀기(0xbdae9) 연출 없음. 국가대항전 두 팀은 대회 레코드(저장 +0x918 · +0x934)를 웹이 저장하지 않아
 * 붙박이 표로 보인다(대한민국에 내 선수가 안 낀다).
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
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'

/** 목록 한 줄이 보여 줄 것 (`widgets/entry-editor` 의 `EntryFace`) */
export interface NariEntryFace {
  readonly name: string
  /** '0' 상세 창 네 칸 — 타자 히트·파워·수비·주루 · 투수 제구·구속·변화·체력 */
  readonly ability: readonly number[]
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

const aceBatterFace = (index: number): NariEntryFace => {
  const ace = ACE_BATTERS[index]
  return ace === undefined
    ? { name: '마타자', ability: [] }
    : { name: ace.name, ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run] }
}

/** 마투수 표의 네 칸은 타자 칸 이름으로 들었다 — 제구·구속·변화·체력 차례 (`aceOpponent` 주석) */
export const acePitcherFace = (index: number): NariEntryFace => {
  const ace = ACE_PITCHERS[index]
  return ace === undefined
    ? { name: '마투수', ability: [] }
    : { name: ace.name, ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run] }
}

/**
 * 타자 탭 목록 — 레코드 타자 배열 차례 그대로(`0x55724` 가 `[팀+0x18]` 을 훑는다). 내 선수 줄은 `me`(타자편 커리어) 로,
 * 마타자 줄은 마선수 표로, 나머지는 그 팀 붙박이 표 행으로 채운다.
 */
export function nariEntryBattersOf(record: NariTeamRecord, teamId: number, me: NariEntryFace | null): NariEntryBatter[] {
  const table = teamBatters(teamId)
  return record.batters.map((row) => {
    if (row.ace !== undefined) return { ...aceBatterFace(row.ace), isAce: true, position: row.position }
    if (row.slot === MY_RECORD_SLOT) {
      return { ...(me ?? { name: '', ability: [] }), isAce: false, position: row.position }
    }
    const player = table[row.slot]
    return { name: player?.name ?? '', ability: player?.ability ?? [], isAce: false, position: row.position }
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
): NariEntryPitcher[] {
  const table = teamPitchers(teamId)
  return order.map((slot) => {
    const found = special(slot)
    if (found !== undefined) return found
    const player = table[slot]
    return { name: player?.name ?? '', ability: player?.ability ?? [], isAce: false }
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

/**
 * **타자편** 143 — 정규·포스트시즌은 저장의 나리 팀 레코드(`nariTeams`)와 142 진입이 돌린 투수 차례(`leagueGamePitchersOf` —
 * g ≠ 0 이면 0xb8c80 로 한 칸 돈 것 · 포스트시즌은 시리즈 이월), 국가대항전(`cup`)은 대회 두 팀 붙박이 표다(머리말 근사).
 */
export function batterNariEntryViewOf(
  career: PlayerCareer,
  isMyTeam: boolean,
  cup?: { readonly myTeam: number; readonly opponent: number },
): NariEntryView {
  if (cup !== undefined) {
    const teamId = isMyTeam ? cup.myTeam : cup.opponent
    const record = tableNariTeamRecord(teamId)
    return openNariEntryView(isMyTeam, teamId, {
      batters: nariEntryBattersOf(record, teamId, null),
      pitchers: nariEntryPitchersOf(teamId, UNSHUFFLED_PITCHER_ORDER),
    })
  }
  const opponent = nextOpponentOf(career)
  const teamId = isMyTeam ? career.teamId : opponent
  const record = nariTeamRecordOf(nariTeamsOf(career), teamId)
  const pitchers = leagueGamePitchersOf(career, opponent)
  const me: NariEntryFace = {
    name: career.name,
    ability: [career.ability.hit, career.ability.power, career.ability.defense, career.ability.run],
  }
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, me),
    pitchers: nariEntryPitchersOf(
      teamId,
      withRecordAcePitcher(isMyTeam ? pitchers.ourOrder : pitchers.opponentOrder, record),
      recordAcePitcherSpecial(record),
    ),
  })
}
