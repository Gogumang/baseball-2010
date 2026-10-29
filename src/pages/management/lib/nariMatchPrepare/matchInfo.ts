import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { leagueGamePitchersOf, nextOpponentOf } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { leagueGamePlayerSideOf } from '@/entities/career/model/leagueGameSetup'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { nationalCupSideOf } from '@/entities/national-cup/model/nationalCup'
import { nariCupRecordOf } from '@/entities/career/model/nariCupTeams'
import { EMPTY_VALUE, seasonMatchInfoLines, type MatchInfoLine } from './otherSlices'
import { NO_NARI_ACE, type NariMatchAces } from './matchAces'

export interface NariMatchInfoInput {
  readonly league: League
  /** S+0xb4 — 있으면 순위 칸 "--" · 승패 칸은 이번 시리즈 */
  readonly postseason: PostseasonSeries | null
  readonly myTeamId: number
  readonly opponentTeamId: number
  /** 내 팀 레코드 0번 투수 이름 — 0x1c46c 가 로테이션을 돌린 뒤 (`0x5e0e8` 은 레코드 0번을 읽는다) */
  readonly myStarterName: string
  /** 상대 팀 투수 레코드 차례 — 0번이 선발 */
  readonly opponentPitcherOrder: readonly number[]
  /** 이번 장면에서 굴린 마선수 — 국가대항전이면 null("-") */
  readonly aces: NariMatchAces | null
  /** 진행 중인 국가대항전 (S+0x12c) — 있으면 순위·승패를 대회 표에서 읽는다(0x5dcc0 → 0xb834c) */
  readonly cup?: NationalCup | null
}

/**
 * 142 경기정보 다섯 줄 — 값 줄 0x5dcc0 은 모드 2·3·4 가 한 갈래다(R4 2d: 순위 · 승패는 0x1fcb5(저장, 모드)의 리그 레코드,
 * 선발 · 마선수는 0x1f9a9(저장, 모드, 팀) 레코드). 시즌 0xdd 의 `seasonMatchInfoLines` 를 나리 리그(S+0x80)로 부른다.
 */
export function nariMatchInfoLines(input: NariMatchInfoInput): readonly MatchInfoLine[] {
  const { aces } = input
  return seasonMatchInfoLines({
    league: input.league,
    series: input.postseason,
    cup: input.cup ?? null,
    inPostseason: input.postseason !== null,
    myTeamId: input.myTeamId,
    opponentTeamId: input.opponentTeamId,
    // 선발은 아래 두 값으로 준다 — 날짜 칸 셈은 안 쓴다
    dayCounter: 0,
    opponentPitcherOrder: input.opponentPitcherOrder,
    myStarterName: input.myStarterName,
    acePitcherId: aces?.myPitcher ?? NO_NARI_ACE,
    aceBatterId: aces?.myBatter ?? NO_NARI_ACE,
    opponentAces: aces === null ? null : { pitcher: aces.opponentPitcher, batter: aces.opponentBatter },
  })
}

/** 142 화면이 그리는 값 — 두 팀(rec+0 · rec+4) · 선공 측(rec+8) · 다섯 줄 */
export interface NariMatchScreenData {
  readonly lines: readonly MatchInfoLine[]
  readonly myTeamId: number
  readonly opponentTeamId: number
  readonly playerSide: PlayerSide
}

/**
 * 타자편(모드 4) 142 — 상대는 일정표·시리즈(`nextOpponentOf`), 측은 `0xb7844(L, 내 팀)`(1c4f0), 두 팀 선발은 0x1c46c 가
 * 돌린 레코드 0번(`leagueGamePitchersOf` — 경기를 세울 때와 같은 값)이다.
 */
export function batterMatchInfoOf(career: PlayerCareer, aces: NariMatchAces | null): NariMatchScreenData {
  const opponentTeamId = nextOpponentOf(career)
  const pitchers = leagueGamePitchersOf(career, opponentTeamId)
  return {
    lines: nariMatchInfoLines({
      league: career.league,
      postseason: career.postseason,
      myTeamId: career.teamId,
      opponentTeamId,
      myStarterName: teamPitchers(career.teamId)[pitchers.ourOrder[0] ?? 0]?.name ?? EMPTY_VALUE,
      opponentPitcherOrder: pitchers.opponentOrder,
      aces,
    }),
    myTeamId: career.teamId,
    opponentTeamId,
    playerSide: leagueGamePlayerSideOf(career),
  }
}

/**
 * 국가대항전 142 — 135 확인(0x10680)에서 온다. 내 팀은 `0xb7614(L, n, 0)` 의 대한민국(10), 상대는 그 라운드 대진.
 * 순위·승패는 대회 표, 마선수 칸은 "-"(1c5fe 가 안 넣는다).
 *
 * 두 팀은 저장의 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 상대국, `nariCupTeams` — 142 가 이미 오늘 준비로 돌린 것)이고 선발 줄은
 * 그 0번 · 측은 0xb7844 의 L+0xac 갈래(대진 칸 0 이 후공 — 결승에서 대한민국이 2위면 선공, `nationalCupSideOf`).
 */
export function cupMatchInfoOf(career: PlayerCareer, matchup: NationalCupMatchup, cup: NationalCup): NariMatchScreenData {
  const teams = career.nariCupTeams
  const myOrder = teams === undefined ? [0] : (nariCupRecordOf(teams, matchup.myTeam).pitchers ?? [0])
  return {
    lines: nariMatchInfoLines({
      league: career.league,
      postseason: null,
      myTeamId: matchup.myTeam,
      opponentTeamId: matchup.opponent,
      myStarterName: teamPitchers(matchup.myTeam)[myOrder[0] ?? 0]?.name ?? EMPTY_VALUE,
      opponentPitcherOrder:
        teams === undefined
          ? teamPitchers(matchup.opponent).map((_pitcher, slot) => slot)
          : (nariCupRecordOf(teams, matchup.opponent).pitchers ?? []),
      aces: null,
      cup,
    }),
    myTeamId: matchup.myTeam,
    opponentTeamId: matchup.opponent,
    playerSide: nationalCupSideOf(cup, matchup.myTeam) as PlayerSide,
  }
}
