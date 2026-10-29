import { isCleared, recordSteal } from '@/entities/mission/model/missionGoal'
import { missionRunnersOf } from '@/entities/mission/model/missionRunners'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/** 도루할 수 있는가 — 1루 주자가 있고 2루가 비어 있어야 한다 (StrHOWTO[2] 1루→2루) */
export function canSteal(run: MissionRun): boolean {
  return run.status === '진행중' && run.bases.first && !run.bases.second
}

/** 도루 성공 — 주자가 2루로 간다. 목표를 채우면 그 자리에서 성공이다. */
export function applySteal(run: MissionRun): MissionRun {
  if (!canSteal(run)) return run

  const progress = recordSteal(run.progress)
  const bases = { ...run.bases, first: false, second: true }
  const before = missionRunnersOf(run)
  const runners = { ...before, first: null, second: before.first }
  return { ...run, bases, runners, progress, status: isCleared(run.mission, progress) ? '성공' : '진행중' }
}
