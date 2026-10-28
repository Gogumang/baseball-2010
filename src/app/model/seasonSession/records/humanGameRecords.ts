import {
  type LeaguePlayerStats,
  leaguePitcherAppearancesOf,
  recordLeaguePitcherAppearances,
  type LeagueFieldingError,
  recordLeagueErrors,
  recordLeagueFreePasses,
} from '@/entities/league/model/leaguePlayerStats'
import type { GameLeaguePitchers } from '@/entities/game/model/gamePitcherLines'
import { recordHumanGamePitchers } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import type { PitcherOfRecord } from '@/entities/game/model/winLossSave'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { KOREA_TEAM_ID } from '@/entities/national-cup/model/nationalCup'
import type { SeasonRecordAces } from '@/entities/season-mode/model/seasonEntry'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { FULL_PITCHER_STAMINA } from '@/entities/season-mode/model/seasonItemShop'
import { recoverStaminaAfterGameDay } from '@/entities/pitcher-career/model/pitcherStamina'
import { SEASON_STAMINA_RECOVERY } from '@/app/model/seasonSession/stamina/stamina'

/**
 * 사람 경기(정규시즌) 투수 줄을 리그 기록표에 쌓는다 — `recordHumanGamePitchers` 와 같은 길에, 판정 받은 투수가 트레이드로
 * 옮겨 온 투수면 그 붙박이 표 팀(요약 `decisionTableTeams`)으로 센다. 원본 경기 끝 0xa7de8 은 판정 투수의 레코드 +0x2e·+0x2f
 * 를 올리고 그 레코드의 id(+0)가 옛 팀 Xls 행이라 기록이 선수를 따라간다. 표 팀이 없으면 그 함수 그대로다.
 */
export function recordSeasonHumanGamePitchers(stats: LeaguePlayerStats, pitchers: GameLeaguePitchers | undefined): LeaguePlayerStats {
  const tableTeams = pitchers?.decisionTableTeams
  const recordIds = pitchers?.decisionRecordIds
  if (pitchers === undefined || (tableTeams === undefined && recordIds === undefined)) {
    return recordHumanGamePitchers(stats, pitchers, true)
  }
  const recordOf = (record: PitcherOfRecord | null, teamId: number | undefined, recordId: number | undefined) => {
    if (record === null) return null
    // 표 밖 투수(영입한 명전·나리)는 줄과 같이 칸 −1 · 원본 id 로 찾는다
    if (recordId !== undefined) return { side: record.side, pitcherSlot: -1, recordId }
    return { side: record.side, pitcherSlot: record.number, ...(teamId === undefined ? {} : { teamId }) }
  }
  const appearances = leaguePitcherAppearancesOf(
    pitchers.lines,
    {
      winner: recordOf(pitchers.decision.winner, tableTeams?.winner, recordIds?.winner),
      loser: recordOf(pitchers.decision.loser, tableTeams?.loser, recordIds?.loser),
      save: recordOf(pitchers.decision.save, tableTeams?.save, recordIds?.save),
    },
    (side) => pitchers.sideTeams[side] ?? pitchers.sideTeams[0],
    (_teamId, pitcherSlot, recordId) => recordId === undefined && (pitcherSlot < 0 || pitcherSlot >= PITCHERS_PER_TEAM),
  )
  return recordLeaguePitcherAppearances(stats, appearances)
}

/**
 * 게이트 0xa56dc 밖에서 쌓이는 두 칸 — 투수 +0x2a 사사구(정산 0xa8024 꼬리 a8b04~a8bee, 볼넷 · 사구마다 지금 마운드 투수)와
 * 타자 +0x2e 실책(수비 그림 0x43278 4381a~43904). 정규시즌 · 포스트시즌 모두 부른다.
 * 국가대항전 사람 경기도 같은 두 칸을 그 경기 레코드(대표팀 · 상대국 슬롯)에 올린다 — 리그 기록표가 아니라 대회 칸
 * (`SeasonSave.cupPlayerStats`, `recordCupUngatedRecords`)에 쌓는다.
 */
export function recordUngatedSeasonRecords(
  stats: LeaguePlayerStats,
  summary: { readonly leaguePitchers?: GameLeaguePitchers; readonly leagueErrors?: readonly LeagueFieldingError[] },
): LeaguePlayerStats {
  return recordLeagueErrors(recordLeagueFreePasses(stats, summary.leaguePitchers?.lines ?? []), summary.leagueErrors ?? [])
}

/**
 * **국가대항전 사람 경기의 게이트 밖 두 칸** — `recordUngatedSeasonRecords` 와 같은 두 칸을 대표팀 슬롯 +0x918 에 쌓는다.
 * 상대국 슬롯 +0x934 몫은 하루 끝 b8216 0x20648 이 마스터에서 새로 덮어 지우므로 대표팀(팀 10) 줄만 남긴다
 */
export function recordCupUngatedRecords(
  stats: LeaguePlayerStats,
  summary: { readonly leaguePitchers?: GameLeaguePitchers; readonly leagueErrors?: readonly LeagueFieldingError[] },
): LeaguePlayerStats {
  return recordLeagueErrors(
    recordLeagueFreePasses(
      stats,
      (summary.leaguePitchers?.lines ?? []).filter((line) => line.teamId === KOREA_TEAM_ID),
    ),
    (summary.leagueErrors ?? []).filter((error) => error.teamId === KOREA_TEAM_ID),
  )
}

/**
 * 경기 끝에 저장에 남길 레코드 마선수 (`SeasonSave.recordAces`).
 * ⚠️ 원본 버그(B-72): 0xdd 진입 0x6548 · CPU 끼리 0xc239c 가 열 팀 시즌 레코드에 넣은 마선수를 빼는 `0xb512c` 는 0xdf 진입 0x5980 ·
 * 0xe5 진입 0x5cd0 두 곳만 부른다 — 그 사이 0xf1 트레이드 요청 0x93c8 · 0xe8 스태미나 목록(십전대보탕) 0x5870 · 포스트시즌 첫날 목표
 * 0xa3764 가 마선수 줄을 본다. **고침(`bugfixes.json` B-72, 기본 켬)**: 경기가 끝나면 곧장 뺀 것(0xb512c × 열 팀)으로 둔다 —
 * 지난 날 남은 것까지 비운다. 굴림 수는 같다(트레이드 요청 · 목표 판정이 마선수 줄 없는 목록을 본다 — 뽑히는 선수가 바뀔 수 있다).
 */
export function seasonRecordAcesAfterGame(
  previous: Readonly<Record<number, SeasonRecordAces>> | undefined,
  added: Readonly<Record<number, SeasonRecordAces>>,
): Readonly<Record<number, SeasonRecordAces>> {
  return isBugFixed('B-72') ? {} : { ...previous, ...added }
}

/**
 * 사람 경기 두 팀 레코드에 남는 마선수 (U-105 r154) — 0xdd 진입 0x6548 이 내 팀(66da · 66e6 — 0xd7 에서 고른 rec+0xe · +0xd)과
 * 상대(66f8 · 670a — 굴린 `opponentAces`)의 **시즌 레코드**에 넣은 줄이다(0xb8680 모드 2 → 0x1f571). 내 마투수 +0x2c 는 경기 끝 값에
 * 하루 끝 4f2bc `0xb617c`(팀 투수 수 [+0xc] 만큼 — 8번 마투수 포함 +20%)를 먹인 값이다. 국가대항전은 넣지 않는다(66ae).
 */
export function humanGameRecordAcesOf(options: TeamGameOptions | null, summary: TeamGameSummary, myTeamId: number): Record<number, SeasonRecordAces> {
  if (options === null) return {}
  const aces: Record<number, SeasonRecordAces> = {}
  const pitcher = options.acePitcherId ?? -1
  const batter = options.aceBatterId ?? -1
  if (pitcher >= 0 || batter >= 0) {
    const ended = summary.ourAcePitcherStamina ?? FULL_PITCHER_STAMINA
    aces[myTeamId] = {
      pitcher,
      batter,
      ...(pitcher >= 0 ? { pitcherStamina: recoverStaminaAfterGameDay(ended, SEASON_STAMINA_RECOVERY) } : {}),
    }
  }
  if (options.opponentAces !== undefined) {
    aces[summary.opponentTeamId] = { pitcher: options.opponentAces.pitcher, batter: options.opponentAces.batter }
  }
  return aces
}
