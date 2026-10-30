import { type SeasonEntryInput, tableRosterOf, seasonStarterNameOf, playerFaceOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { PreGameAces } from '@/entities/season-mode/model/preGameFlow'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { seasonEntryCellSourceOf } from '@/app/model/seasonSession/records/entryCells'
import { cpuRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { PendingSeasonGame, SeasonGameKind } from '@/app/model/seasonSession/types/session'

/**
 * 0xe0 의 유저 팀 명단 — 정규·포스트시즌은 시즌 세이브 명단(+ 0xd7 에서 고른 마선수), 국가대항전은
 * 대한민국 명단(마선수 없음, 0x6548 66ae). 로테이션 날짜는 경기 옵션과 같은 값이다.
 */
export function userEntrySourceOf(current: SeasonSave, pending: PendingSeasonGame, preGameAces: PreGameAces): SeasonEntryInput {
  const dayCounter = pending.options.dayCounter ?? 0
  if (pending.kind === '국가대항전') return cupEntrySourceOf(current, pending.options.ourTeamId, dayCounter)
  const teamId = current.state.record.teamId
  return {
    teamId,
    roster: current.roster,
    dayCounter,
    acePitcherId: preGameAces.pitcher,
    aceBatterId: preGameAces.batter,
    cells: seasonEntryCellSourceOf(current, teamId, true),
  }
}

function cupEntrySourceOf(current: SeasonSave, teamId: number, dayCounter: number): SeasonEntryInput {
  return {
    teamId,
    roster: current.cupRoster ?? tableRosterOf(teamId),
    dayCounter,
    acePitcherId: -1,
    aceBatterId: -1,
    cells: {
      ...seasonEntryCellSourceOf(current, teamId, true),
      // 대표팀 칸 +0x918 은 대회 초기화 b7c72 0x205c0 이 마스터 팀 10 으로 새로 채운 것이라 사기 +2 는 표값이다 —
      // 시즌 사기 칸(0x1f570(저장, SR[1]))은 대회 중 상대국 슬롯 +0x934 로 돌아가 이 칸을 안 쓴다(1f58a~1f5a4)
      teamMorale: teamRecordMoraleOf(teamId),
      // 투수 +0x2c 는 대회 초기화 b7c88 · 하루 끝 b81e0 의 0xb6190(팀 10) 이 전원 10000 으로 채운다 — 사람 경기가 깎은 값은
      // 그 경기 결과 장면의 하루 끝에서 다시 차므로 0xe0 에 들어올 때는 늘 10000 이다. 웹 `cupRoster` 는 경기 끝 값을 받지
      // 않고(옛 저장은 0 으로 들었다) 이 칸을 쓰지 않는다
      staminaOf: () => FULL_STAMINA,
    },
  }
}

/**
 * CPU 팀 명단 — 트레이드로 바뀌었으면 저장의 레코드. 붙박이 표에 0xdd 진입에서 굴린 마선수(`opponentAces`,
 * 0x6548 66f8·670a)를 8·9번에 끼운다. 편집기는 보기 전용이다.
 */
export function cpuEntrySourceOf(save: SeasonSave, options: TeamGameOptions): SeasonEntryInput {
  const aces = options.opponentAces
  return {
    teamId: options.opponentTeamId,
    roster: cpuRosterOf(save, options.opponentTeamId),
    dayCounter: options.opponentDayCounter ?? options.dayCounter ?? 0,
    acePitcherId: aces?.pitcher ?? -1,
    aceBatterId: aces?.batter ?? -1,
    cells: seasonEntryCellSourceOf(save, options.opponentTeamId, false),
  }
}

/** 편집한 유저 팀 명단을 저장에 — 국가대항전은 대표팀 슬롯 +0x918(대회 내내 남는다), 그 밖은 시즌 명단 */
export function withEntryRoster(save: SeasonSave, kind: SeasonGameKind, roster: SeasonTeamRoster): SeasonSave {
  return kind === '국가대항전' ? { ...save, cupRoster: roster } : { ...save, roster }
}

/** 0xdd "선발" 줄 — 내 팀 명단(엔트리 편집 결과)의 투수 0번 */
export function userStarterNameOf(save: SeasonSave, pending: PendingSeasonGame, preGameAces: PreGameAces): string | null {
  const source = userEntrySourceOf(save, pending, preGameAces)
  return seasonStarterNameOf(source.teamId, source.roster, source.dayCounter)
}

/**
 * 0xdd 상대 "선발" 줄 — 0x5e0e8 이 상대 팀 레코드 0번을 읽는다. 레코드 0번 = 투수 차례(`opponentPitcherOrder`)의 0번 칸에
 * 앉은 선수라, 트레이드로 바뀐 CPU 팀은 저장 명단(`cpuRosterOf`)의 그 칸 선수 이름이다. 차례가 없는 길(국가대항전)은 null
 */
export function opponentStarterNameOf(save: SeasonSave, options: TeamGameOptions): string | null {
  if (options.opponentPitcherOrder === undefined) return null
  const opponent = options.opponentTeamId
  const index = options.opponentPitcherOrder[0] ?? 0
  const player = cpuRosterOf(save, opponent).pitchers[index]
  return player === undefined ? null : playerFaceOf(opponent, player, true, index).name
}
