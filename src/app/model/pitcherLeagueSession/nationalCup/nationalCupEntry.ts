import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { KOREA_TEAM_ID, createNationalCup, nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { createPitcherCupTeams } from '@/entities/pitcher-career/model/pitcherCupTeams'

/**
 * 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 세운 대회와 대표팀 칸(모드 3 갈래 0xb521d 내 칸)을 들고 S+0x50 = 3(웹 null) ·
 * S+0x12c = 1. 보상 명령 뒤(0x8cca2)와 재생 끝(`continueYearEnd`) 둘 다 이 꼴이다 — 굴림 없이 서므로 두 번 세워도 같은 값이다.
 * 칭호 8 은 134 첫 틀(0x1b92c 머리) 몫이라 여기 없다.
 */
export function withPitcherNationalCupEntered(career: PitcherCareer): PitcherCareer {
  const cup = createNationalCup()
  return {
    ...career,
    seasonEndState: null,
    nationalCup: cup,
    nariCupTeams: createPitcherCupTeams(career.positionCode, nationalCupMatchupOf(cup)?.opponent ?? KOREA_TEAM_ID),
  }
}
