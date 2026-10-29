import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * 공 프레임 F — 투수 애니가 놓는 단계(평범 6 · 마투수 0xcfbe4[순번])에 닿은 뒤부터 매 틱 +1 (0x3f378).
 * `phaseTicks` 는 0x11 에 든 뒤 흐른 장면 틱이다. 그 전에는 음수라 공을 그리지 않는다. `aceOrder` 는 마운드 마투수 순번(없으면 평범한 투수)
 */
export function ballFrameOf(phaseTicks: number, aceOrder?: number | null): number {
  return phaseTicks - pitcherReleaseTicksOf(aceOrder)
}

/** 공 프레임 F 가 서는 장면 틱 — `ballFrameOf` 의 거꾸로 (`phaseStartTick` = 0x11 에 든 장면 틱) */
export function ballFrameStartTick(frame: number, phaseStartTick: number, aceOrder?: number | null): number {
  return phaseStartTick + frame + pitcherReleaseTicksOf(aceOrder)
}
