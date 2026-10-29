import { advanceDefense } from '@/entities/mission/model/pitcherRun/outcome/advanceDefense'
import { allowedAfterPlay, brokenConditionsOf } from '@/entities/mission/model/pitcherRun/outcome/allowedLimits'
import { judgeStatus } from '@/entities/mission/model/pitcherRun/judge/judgeStatus'
import type { AtBatOutcome } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { PitcherOutcomeOptions, PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import { missionCpuAfterPlateAppearance } from '@/entities/mission/model/missionCpuTeam'
import { cpuSideOf, withMissionScore } from '@/entities/mission/model/missionGame'
import { recordPitcherOutcome } from '@/entities/mission/model/missionGoal'

/** 타석이 끝났다. 목표를 채우면 성공, 한도·제한에 닿으면 실패다. */
export function applyPitcherOutcome(run: PitcherRun, outcome: AtBatOutcome, options: PitcherOutcomeOptions = {}): PitcherRun {
  if (run.status !== '진행중') return run

  const defense = advanceDefense(run, outcome, options)
  // 목표·피안타는 판 끝 정산이 낸 결과로 센다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다(`battedContact`)
  const settled = defense.outcome
  const allowed = allowedAfterPlay(run.allowed, defense, options.settledRunnerFates)
  const progress = recordPitcherOutcome(
    run.progress,
    settled,
    // MAX게이지는 `recordPitch` 가 공마다 이미 셌다
    0,
    brokenConditionsOf(run.mission, allowed),
    // 아웃 콜 수 — 병살 2 · 삼중살 3 · 안타 판의 주자 아웃 1 (R+0x13c, `recordPitcherOutcome` 머리글). 셋째 아웃에서 판이 끝난다
    defense.outsAtSettlement - run.outs,
  )
  const remainingPlate = run.remainingPlateAppearances === null ? null : run.remainingPlateAppearances - 1
  const totalOuts = run.totalOuts + defense.outsAdded

  const next: PitcherRun = {
    ...run,
    progress,
    remainingPlateAppearances: remainingPlate,
    perfectGauges: 0,
    bases: defense.bases,
    runners: defense.runners,
    outs: defense.outs,
    totalOuts,
    allowed,
    // 같은 정산 0xa8024 가 CPU 타자의 타순 칸 기록(+0x12 · +0x13 · +0x14)을 올리고 0xaf020 이 타순을 넘긴다
    cpu: missionCpuAfterPlateAppearance(run.cpu, settled),
    game: withHalfEnd(withMissionScore(run.game, cpuSideOf(run.mission), defense.runsScored), defense.isInningOver),
  }
  return { ...next, status: judgeStatus(next, defense.outsAtSettlement) }
}

/** 사람 반 이닝이 3아웃으로 끝났다 — 0x18 · 자동진행(`runPitcherMissionAutoHalves`)을 기다린다 */
export function withHalfEnd(game: PitcherRun['game'], isInningOver: boolean): PitcherRun['game'] {
  return isInningOver ? { ...game, halfEnded: true } : game
}
