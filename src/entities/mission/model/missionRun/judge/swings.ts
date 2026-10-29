import { isOutOfAnyGoalChances } from '@/entities/mission/model/missionRun/judge/goalChances'
import { isMissionBatterUp } from '@/entities/mission/model/missionRun/start/batterUp'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/** 배트를 냈다 (헛스윙·파울 포함). 스윙 제한이 있는 미션만 줄어든다 — 스윙 칸(코드 9)은 미션 타자의 스윙만 센다. */
export function recordSwing<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null || !isMissionBatterUp(run)) return run
  return { ...run, remainingSwings: run.remainingSwings - 1 }
}

/** 타석이 끝나지 않았는데 스윙을 다 썼거나, 남은 스윙으로 목표를 못 채우면(0xaa958) 실패다. */
export function checkSwingsExhausted<T extends MissionRun>(run: T): T {
  if (run.status !== '진행중' || run.remainingSwings === null) return run
  if (run.remainingSwings <= 0) return { ...run, status: '실패' }
  return isOutOfAnyGoalChances(run, run.remainingPlateAppearances) ? { ...run, status: '실패' } : run
}

export function giveUp(run: MissionRun): MissionRun {
  return run.status === '진행중' ? { ...run, status: '실패' } : run
}
