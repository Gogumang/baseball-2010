/**
 * 투수편(모드 3) **142 경기 준비** 화면 값 — 진입 0x1c46c 가 세운 두 팀(rec+0 · rec+4 · rec+8)과 경기정보 다섯 줄.
 * 타자편 `batterMatchInfoOf` 와 같은 꼴이고, 선발 줄만 투수편 갈래다.
 */
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherLeagueGameSetupOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHERS_PER_TEAM, teamPitchers } from '@/entities/team/model/teamRoster'
import { EMPTY_VALUE } from '@/pages/general-mode/lib/matchInfoLines'
import { nariMatchInfoLines } from '@/pages/management/lib/nariMatchPrepare'
import type { NariMatchAces, NariMatchScreenData } from '@/pages/management/lib/nariMatchPrepare'
import { pitcherGameOptionsOf } from '@/pages/pitcher-league/model/pitcherGameOptions'

/**
 * 내 팀 "선발" — 레코드 0번. 142 진입 0x1c46c 가 내 팀 투수 배열을 오늘 준비대로 고친 뒤(`prepareMyPitcherMatch`)의 0번이고,
 * 경기 진행기도 같은 배열(`pitcherLeagueGameSetupOf` 의 `ourPitcherOrder`)로 선다.
 */
function myStarterNameOf(career: PitcherCareer, ourPitcherOrder: readonly number[]): string {
  const slot = ourPitcherOrder[0]
  if (slot === undefined) return EMPTY_VALUE
  if (slot >= PITCHERS_PER_TEAM) return career.name
  return teamPitchers(career.teamId)[slot]?.name ?? EMPTY_VALUE
}

export function pitcherMatchInfoOf(career: PitcherCareer, aces: NariMatchAces | null): NariMatchScreenData {
  const options = pitcherGameOptionsOf(career)
  const setup = pitcherLeagueGameSetupOf(career, options.opponentTeamId)
  return {
    lines: nariMatchInfoLines({
      league: career.league,
      postseason: career.postseason,
      myTeamId: career.teamId,
      opponentTeamId: options.opponentTeamId,
      myStarterName: myStarterNameOf(career, setup.ourPitcherOrder),
      opponentPitcherOrder: setup.opponentPitcherOrder,
      aces,
    }),
    myTeamId: career.teamId,
    opponentTeamId: options.opponentTeamId,
    playerSide: options.playerSide,
  }
}
