import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createNariCupTeams, nariCupBattingOrderOf, nariCupRecordOf, type NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { renumberedBattingOrderOf, nariQuickLineupOf } from '@/entities/career/model/nariTeamRecord'
import { KOREA_TEAM_ID, createNationalCup, nationalCupMatchupOf, nationalCupSideOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { nariMoraleOf, withNariGameMorale } from '@/entities/career/model/nariMorale'
import type { PlayerSide } from '@/entities/game/model/gameState'
import type { MatchSetup } from '@/app/model/careerSession/game/useStartMatch'

/**
 * 저장의 국가대항전 대회 레코드 두 칸 — 없으면(대회 중 옛 저장) 대회 초기화 꼴로 세운다 (`createNariCupTeams`)
 */
export function cupTeamsOf(career: PlayerCareer, opponentTeamId: number): NariCupTeams {
  return career.nariCupTeams ?? createNariCupTeams(renumberedBattingOrderOf(career) - 1, opponentTeamId)
}

/**
 * 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 세운 대회와 대표팀 칸(+0xbc4 대표팀 · +0xbe0 첫날 상대 · 0xb53f1 내 칸)을 들고
 * S+0x50 = 3(웹 null) · S+0x12c = 1. 보상 명령 뒤(0x8cca2)와 재생 끝(`continueSeason`) 둘 다 이 꼴이다 — 대회 · 칸은 굴림 없이
 * 서므로 두 번 세워도 같은 값이다. 칭호 8 은 134 첫 틀(0x1b92c 머리) 몫이라 여기 없다.
 */
export function withNationalCupEntered(career: PlayerCareer): PlayerCareer {
  const cup = createNationalCup()
  return {
    ...career,
    seasonEndState: null,
    nationalCup: cup,
    nariCupTeams: createNariCupTeams(renumberedBattingOrderOf(career) - 1, nationalCupMatchupOf(cup)?.opponent ?? KOREA_TEAM_ID),
  }
}

/**
 * 국가대항전 경기 — 경기 장면 0xb891c 가 두 팀을 대회 레코드 두 칸으로 세운다: 타순 = 대표팀 타자 배열(내 선수 · 벤치로 간 선수),
 * 선발 = 두 칸 투수 0번(142 가 돌린 차례). 두 칸 스태미나는 날마다 10000(대표팀 b81e0 · 상대국 새 복사). 1c5fe 가 마선수를 안 넣었다.
 */
export function cupMatchSetupOf(current: PlayerCareer, matchup: NationalCupMatchup, cup: NationalCup): MatchSetup {
  const teams = cupTeamsOf(current, matchup.opponent)
  return {
    ourTeamId: matchup.myTeam,
    battingOrder: nariCupBattingOrderOf(teams) ?? current.battingOrder,
    opponentTeamId: matchup.opponent,
    dayCounter: 0,
    // 0xb7844 의 L+0xac 갈래 — 대진 칸 0 이 후공: 풀리그는 늘 대한민국 · 결승은 풀리그 1위라 대한민국이 2위면 선공
    playerSide: nationalCupSideOf(cup, matchup.myTeam) as PlayerSide,
    pitchers: {
      ourOrder: nariCupRecordOf(teams, matchup.myTeam).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
      opponentOrder: nariCupRecordOf(teams, matchup.opponent).pitchers ?? UNSHUFFLED_PITCHER_ORDER,
    },
    ourRecordLineup: nariQuickLineupOf(teams.korea),
    // 대회 중 나리 저장 +0xb2 = L+0x32 는 대회 날짜다(0xb7bf0 이 0 으로 놓고 하루 끝마다 +1)
    skyDayCounter: cup.day,
    // 0xb570c 의 사기 감소는 b5768 이 쓴 0xa3a24 값 — 대회 중이면 상대국 칸 +2(원본 버그, `withNariGameMorale`)
    myRunAbility: effectiveAbilityOf(withNariGameMorale(current)).run,
    // 두 팀 레코드 +2 = 0xa3a24 — 대회 중이라 상대국 칸 +2 (대표팀 칸도 3a332 · b5768 이 이 값으로 덮는다)
    teamMorale: nariMoraleOf(current),
  }
}
