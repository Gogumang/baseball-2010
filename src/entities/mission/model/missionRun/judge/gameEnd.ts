import { isMissionGameOver } from '@/entities/mission/model/missionGame'
import { OUTS_PER_INNING, type MissionRun } from '@/entities/mission/model/missionRun/types'

/** 판 끝 판정 0xaaa6c aad20 — 경기 끝(0xb68fc)인데 아직이면 실패. `outs` 는 판정 때 state[6](3아웃 판이면 3) */
export function judgedAtGameEnd<T extends MissionRun>(run: T, outs: number): T {
  if (run.status !== '진행중') return run
  return isMissionGameOver(run.game, Math.min(OUTS_PER_INNING, outs)) ? { ...run, status: '실패' } : run
}
