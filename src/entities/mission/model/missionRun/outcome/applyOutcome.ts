import type { RandomPort } from '@/shared/api/random/randomPort'
import { isCleared, recordOutcome, type MissionProgress } from '@/entities/mission/model/missionGoal'
import { missionCpuAfterRuns } from '@/entities/mission/model/missionCpuTeam'
import { missionRunnersAfterPlay } from '@/entities/mission/model/missionRunners'
import { judgedAtGameEnd } from '@/entities/mission/model/missionRun/judge/gameEnd'
import { isOutOfAnyGoalChances } from '@/entities/mission/model/missionRun/judge/goalChances'
import { advanceSituation } from '@/entities/mission/model/missionRun/play/advanceSituation'
import { isMissionBatterUp } from '@/entities/mission/model/missionRun/start/batterUp'
import { afterHumanPlateAppearance, isBatterReachedKind } from '@/entities/mission/model/missionRun/outcome/humanPlateAppearance'
import { OUTS_PER_INNING, type MissionRun } from '@/entities/mission/model/missionRun/types'
import { survivorsFromBaseOfFates, type AtBatOutcome, type DefensePlayResult } from '@/entities/mission/model/missionRun/otherSlices'

type MissionSituation = ReturnType<typeof advanceSituation>

/**
 * 타석 하나가 끝났을 때. 목표를 채우면 즉시 성공, 제한을 넘기면 실패다.
 *
 * `random` 을 주면 수비 진행기의 원본 확률 굴림이 돈다 — 안 주면 지금까지와 같은 결정론이다.
 * `played` 를 주면 **화면(상태 0x17)이 이미 돌린** 플레이의 결과를 그대로 먹인다.
 */
export function applyOutcome(run: MissionRun, outcome: AtBatOutcome, isBunt = false, random?: RandomPort, played?: DefensePlayResult): MissionRun {
  if (run.status !== '진행중') return run

  const situation = advanceSituation(run, outcome, random, played)
  // 미션 타자가 아닌 사람 칸 타순(마스터 줄)의 타석은 목표 · 타석 칸에 안 든다 (0xa57f8 a5844 — `isMissionBatterUp`)
  const counts = isMissionBatterUp(run)
  // 목표는 판 끝 정산(0xa8024 → 미션 판정 0xaaa6c)이 낸 결과로 센다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다
  const progress = counts ? recordOutcome(run.progress, situation.outcome, situation.runsScored, isBunt, situation.groundHomeRun) : run.progress
  const advanced = movedBySituation(run, situation)
  const remaining = remainingPlateAppearancesAfter(run, counts)

  if (isCleared(run.mission, progress)) {
    return { ...advanced, progress, remainingPlateAppearances: remaining, status: '성공' }
  }
  const judged: MissionRun = {
    ...advanced,
    progress,
    remainingPlateAppearances: remaining,
    status: isOutOfChancesAfter(run, progress, remaining) ? '실패' : '진행중',
  }
  return judgedAtGameEnd(judged, situation.inningEnded ? OUTS_PER_INNING : situation.outs)
}

/** 남은 타석 — 제한이 있고 미션 타자의 타석일 때만 하나 준다 */
function remainingPlateAppearancesAfter(run: MissionRun, counts: boolean): number | null {
  if (run.remainingPlateAppearances === null || !counts) return run.remainingPlateAppearances
  return run.remainingPlateAppearances - 1
}

/** 판이 옮긴 루 · 주자 신원 · 아웃 · CPU 실점 · 점수판과 타순 */
function movedBySituation(run: MissionRun, situation: MissionSituation): MissionRun {
  return {
    ...run,
    bases: situation.bases,
    // 판의 살아남은 주자로 신원을 민다 — 지금 타자 칸은 판 앞 타순(정산 뒤 0xaf020 이 넘긴다)
    runners: missionRunnersAfterPlay(
      run,
      { bases: situation.bases, inningOver: situation.inningEnded },
      {
        batterReached: isBatterReachedKind(situation.outcome.kind),
        runsScored: situation.runsScored,
        survivorsFromBase: survivorsFromBaseOfFates(situation.runnerFates),
      },
    ),
    outs: situation.outs,
    // 점수판 득점 0xa5c34 → CPU 수비 투수의 실점 A·B, 3아웃이면 이닝 교대 0xa5b00 의 A = 0
    cpu: missionCpuAfterRuns(run.cpu, situation.runsScored, situation.inningEnded),
    game: afterHumanPlateAppearance(run.game, run.mission, situation.outcome, situation.runsScored, situation.inningEnded),
  }
}

/** 타석 · 스윙을 다 썼거나, 0xaa958 — 남은 타석 · 스윙으로 목표를 못 채우면 그 자리에서 실패 */
function isOutOfChancesAfter(run: MissionRun, progress: MissionProgress, remaining: number | null): boolean {
  return (
    (remaining !== null && remaining <= 0) ||
    (run.remainingSwings !== null && run.remainingSwings <= 0) ||
    isOutOfAnyGoalChances({ ...run, progress }, remaining)
  )
}
