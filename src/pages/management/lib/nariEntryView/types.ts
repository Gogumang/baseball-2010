import type { EntryBatterRow, EntryEditorState, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterLine, EntryPitcherLine, PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'

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
  /**
   * '0' 상세 창 0x5b798 레코드 칸 — 붙박이 표 행 · 마선수 표 · 내 선수 줄(커리어를 레코드 칸으로 옮긴 것, `myBatterEntryFaceOf` ·
   * 투수편 `pitcherEntryView`). 내 선수는 육성(+0xa 비트 7)이라 연봉 칸이 저장 +0x1c8 × 100 이다(`nurturedSalary`)
   */
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
 * 사기 V[+2] — 체력 줄 용량 0x66e44(팀 레코드, rec, 0) 이 읽는 그 레코드 +2 (`nariEntryTeamMoraleOf`):
 *   내 팀은 0xa3a24 · 0xa3a44 가 읽고 쓰는 칸 0x1f988(저장, R[1]) +2 = 커리어 사기 (타자편 · 투수편 같다, `PitcherStatusBoard`).
 *   그 밖 팀은 **그 팀이 마지막으로 선 경기 때의 나리 사기**다 — 실효 능력치 0xb570c 모드 3·4 갈래 b5762~b576a 가 공마다 넘겨 받은
 *   팀 레코드 +2 에 0xa3a24 를 쓰고, CPU 끼리 간이 엔진도 두 팀 모두 부른다(0xc1308 · 0xc1320, 넷째 인자 1). 커리어
 *   `teamRecordMorales`(r101 — 사람 경기 상대 · 그날 CPU 경기 여덟 팀 · CPU 포스트시즌 두 팀, 새 시즌 0x1b768 은 안 건드림)가 그 값이고
 *   옛 저장에 없으면 표값 100 (`nariTeamRecordMoraleOf`, r128 이음).
 * 국가대항전 두 칸(+0xbc4 · +0xbe0)은 `isCupRecord` — 마스터 팀 복사본이라 붙박이 줄 +0x20~ 가 Xls 행 그대로다(`nariCupEntryCellSourceOf`).
 * 정규·포스트시즌의 내 선수 줄(표 밖)은 커리어 시즌 줄로 채운다(`myBatterEntryLineOf` · 투수편 `myPitcherEntryCellsOf`, r213).
 */
export interface NariEntryCellSource {
  readonly stats: LeaguePlayerStats
  /** 그 팀 붙박이 표 칸별 +0x2c — 없으면 10000 */
  readonly staminas: readonly number[] | undefined
  /** [ed+0x334] = 모드 */
  readonly staminaMode: number
  readonly morale: number
  /**
   * 국가대항전 대회 칸(+0xbc4 대표팀 · +0xbe0 상대국)인가 — 참이면 붙박이 줄의 기록 열 · +0x2c 를 리그 기록표가 아니라 그 선수 Xls 행에서
   * 읽는다(`nariCupEntryCellSourceOf` 근거). `stats` · `staminas` 는 안 쓴다
   */
  readonly isCupRecord?: boolean
  /** 대회 칸이 대표팀 칸이면 거기 쌓인 붙박이 칸별 +0x2e 실책 (`NariCupTeams.koreaErrors`) */
  readonly cupErrors?: Readonly<Record<number, number>>
}
