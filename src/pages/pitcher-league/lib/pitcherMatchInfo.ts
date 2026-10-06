/**
 * 투수편(모드 3) **142 경기 준비** 화면 값 — 진입 0x1c46c 가 세운 두 팀(rec+0 · rec+4 · rec+8)과 경기정보 다섯 줄.
 * 타자편 `batterMatchInfoOf` 와 같은 꼴이고, 선발 줄만 투수편 갈래다.
 */
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherLeagueGameSetupOf } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCHER_EDITION_MODE, rotationSlotOf, startAssignmentOf,
} from '@/entities/pitcher-career/model/pitcherRotation'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { EMPTY_VALUE } from '@/pages/general-mode/lib/matchInfoLines'
import { nariMatchInfoLines } from '@/pages/management/lib/nariMatchPrepare'
import type { NariMatchAces, NariMatchScreenData } from '@/pages/management/lib/nariMatchPrepare'
import { pitcherGameOptionsOf, startsTodayFor } from '@/pages/pitcher-league/model/pitcherGameOptions'

/**
 * 내 팀 "선발" — 레코드 0번. 0x1c46c 의 모드 3 갈래(1c58c~1c5ea)가 `0xa4f60` 의 k 로 정한다: 선발 보직이면 내 투수가 0번
 * (맞바꿈 없음 · 내 선발 날)이거나 k 번 투수(0↔k), 그 밖 보직은 0~3 이 도는 로테이션의 0번이다.
 * 경기 진행기가 우리 팀 차례를 세우는 셈(`pitcherGameFlow.ourPitcherOrderOf` 의 0번)과 같게 센다.
 * ⚠️ 그 셈 자체가 새 시즌 0x1b684 의 0↔k 를 근사한 것이라(진행기 주석) 이 줄도 같은 근사다.
 */
function myStarterNameOf(career: PitcherCareer): string {
  const options = pitcherGameOptionsOf(career)
  if (career.role !== PITCHER_ROLE.starter) {
    return teamPitchers(career.teamId)[rotationSlotOf(options.dayCounter)]?.name ?? EMPTY_VALUE
  }
  const assignment = startAssignmentOf({
    mode: PITCHER_EDITION_MODE,
    dayCounter: options.dayCounter,
    role: career.role,
    isPostseason: options.isPostseason,
  })
  if (startsTodayFor(career) || assignment < 1) return career.name
  // 새 시즌 목록 [나, 1, …, 7, 0] 의 k 번 칸은 붙박이 표 k 번 투수다
  return teamPitchers(career.teamId)[assignment]?.name ?? EMPTY_VALUE
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
      myStarterName: myStarterNameOf(career),
      opponentPitcherOrder: setup.opponentPitcherOrder,
      aces,
    }),
    myTeamId: career.teamId,
    opponentTeamId: options.opponentTeamId,
    playerSide: options.playerSide,
  }
}
