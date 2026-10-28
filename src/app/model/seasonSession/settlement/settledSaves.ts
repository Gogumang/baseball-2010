import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { playLeagueDay } from '@/entities/league/model/leagueDay'
import { SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { advanceNationalCupDay, nationalCupAbilityContextOf } from '@/entities/national-cup/model/nationalCupPlay'
import { SEASON_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { teamRecordMoraleAfterBurst, teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { isBugFixed } from '@/shared/config/bugfixes'
import { humanGameRecordAcesOf, recordCupUngatedRecords, seasonRecordAcesAfterGame } from '@/app/model/seasonSession/records/humanGameRecords'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/** 국가대항전 경기 정산이 커밋하는 저장 — `useSettleGame` 의 `settleGame` 몸통에서 그대로 떼어 냈다(r346) */
export function cupSettledSaveOf(
  current: SeasonSave,
  cup: NationalCup,
  winner: number,
  loser: number,
  random: RandomPort,
  summary: TeamGameSummary,
  opponent: number,
  burstDeltas: readonly BurstRewardDelta[],
  played: SeasonRecord,
): SeasonSave {
  return {
    ...current,
    // CPU 경기도 모드 2 의 0xb570c — 팀 정액(마스터 상대국 값) · 코치가 붙는다 (`nationalCupAbilityContextOf`)
    cup: advanceNationalCupDay(
      cup,
      winner,
      loser,
      random,
      summary.opponentPitcherStaminas,
      // 그 레코드 +2 도 사람 경기의 돌발 사기(종류 1)가 쌓인 값이다 — 두 나라 용량 0x66e44 가 읽는다 (8e3d2 → 0x1f570 1f5a0)
      {
        ...nationalCupAbilityContextOf(SEASON_MODE, current.state.record.coach),
        nariMorale: teamRecordMoraleAfterBurst(teamRecordMoraleOf(opponent), burstDeltas),
      },
    ),
    // 게이트 밖 두 칸(+0x2a · +0x2e)은 그 경기 레코드 — 대표팀 슬롯 +0x918 에 남는다(상대국 슬롯 몫은 하루 끝에 덮인다)
    cupPlayerStats: recordCupUngatedRecords(current.cupPlayerStats ?? EMPTY_LEAGUE_PLAYER_STATS, summary),
    state: { ...current.state, record: played },
  }
}

/** 정규시즌 경기 정산이 커밋하는 저장 — `useSettleGame` 의 `settleGame` 몸통에서 그대로 떼어 냈다(r346) */
export function regularSeasonSettledSaveOf(
  rested: SeasonSave,
  day: ReturnType<typeof playLeagueDay>,
  gameOptions: TeamGameOptions | null,
  summary: TeamGameSummary,
  record: SeasonRecord,
  evaluated: SeasonState,
): SeasonSave {
  return {
    ...rested,
    // 그날 열 팀 레코드에 들어간 마선수 — CPU 끼리 0xc239c(c24aa~c24ee) · 사람 경기 0xdd 0x6548. 0xb512c 는 0xdf · 0xe5 진입만
    // 부르므로 0xf1 트레이드 요청 · 0xe8 목록까지 남는다 (U-105 r154)
    recordAces: seasonRecordAcesAfterGame(rested.recordAces, {
      ...Object.fromEntries(Object.entries(day.recordAces).map(([team, aces]) => [team, { pitcher: aces.pitcher, batter: aces.batter }])),
      ...humanGameRecordAcesOf(gameOptions, summary, record.teamId),
    }),
    league: day.league,
    playerStats: day.playerStats,
    state: {
      ...evaluated,
      record: {
        ...evaluated.record,
        games: evaluated.record.games + 1,
        // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
        acted: false,
        phase: SEASON_PHASE.경기끝,
        // B-29 고친 길 — 새 경기의 0xe9 정산은 아직이다
        ...(isBugFixed('B-29') ? { incomeSettled: false } : {}),
        // SR+0x1c0 — 0xc2a48 끝(c2be0)이 모드 2 · 국가대항전·포스트시즌 아님일 때만 오늘 점수표를 복사한다.
        // 이 갈래가 곧 그 조건이다(포스트시즌·국가대항전은 위에서 먼저 돌아갔다)
        dayBoard: day.board,
      },
    },
  }
}
