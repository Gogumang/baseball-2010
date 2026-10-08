import type { OriginalMission } from '@/shared/config/original/missions'
import { runScoreBoardSourceOf } from '@/pages/defense/lib/runScoreBoard'
import type { RunScoreBoardSource } from '@/pages/defense/ui/DefensePlayback'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

/**
 * **미션 수비 재생의 득점 점수판 0x41a64 재료** — 미션 경기 준비 0xaa57c(모드 5·6)가 세운 경기 칸을 그대로 쓴다:
 * - 두 측 팀 경기[0x28 + 칸](0xb6bd4) · 사람/CPU 칸 경기[0x31 + 칸](0xb6c18) — 레코드 +2 · +3 윗 4비트(`sideTeams` · `humanSide`).
 * - 공격 측 st[9](0xb6bc0, aa6ac): 투수 미션(모드 5)은 다른 칸, 타자 미션(모드 6)은 사람 칸.
 * - 두 점수 0xb69b0 — 플레이가 시작될 때 사람 측 · 다른 측 점수(`scores`, 부르는 쪽이 센다).
 */
export function missionRunScoreBoardOf(
  mission: OriginalMission,
  scores: { readonly ours: number; readonly opponents: number },
): RunScoreBoardSource {
  const humanSide = mission.humanSide
  const otherSide = humanSide === 0 ? 1 : 0
  const battingSide = mission.side === '투수' ? otherSide : humanSide
  return runScoreBoardSourceOf(
    { playerSide: humanSide, ourScore: scores.ours, opponentScore: scores.opponents, half: battingSide === 0 ? '초' : '말' },
    humanVsComputerSidesOf(humanSide, mission.sideTeams[humanSide]!, mission.sideTeams[otherSide]!),
  )
}

/**
 * **점수판 틀 0x41440 의 두 측** — 경기[0x28 + 칸](0xb6bdd) 팀 · 경기[0x31 + 칸](0xb6c21) CPU 표시. 미션 준비 0xaa57c 가 레코드 +2 · +3
 * 으로 세운 그대로다(사람 칸 0 · 다른 칸 1, aa658 · aa666). 첫 0x18 판(그리기 0x4fe9c 4ff12)이 쓴다.
 */
export function missionScoreboardSidesOf(mission: OriginalMission): readonly [ScoreboardSide, ScoreboardSide] {
  const humanSide = mission.humanSide
  const otherSide = humanSide === 0 ? 1 : 0
  return humanVsComputerSidesOf(humanSide, mission.sideTeams[humanSide]!, mission.sideTeams[otherSide]!)
}
