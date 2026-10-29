import {
  ACE_PITCH_LAST_STEPS,
  ACE_PITCH_STEP_DURATIONS,
  ACE_RELEASE_STEPS,
  IDLE_DURATIONS,
  IDLE_END_STEP,
  IDLE_LAST_STEP,
  PITCH_LAST_STEP,
  PITCH_STEP_DURATIONS,
  RELEASE_STEP,
} from '@/widgets/batting-stage/lib/stageScenery/pitchStepTables'

/** 표에 있는 마투수 순번인가 (0~4). 아니면 평범한 투수 표를 쓴다 */
export function aceRowOf(aceOrder: number | null | undefined): number | null {
  return aceOrder !== null && aceOrder !== undefined && aceOrder >= 0 && aceOrder < ACE_PITCH_LAST_STEPS.length ? aceOrder : null
}

/** 단계 0..last 가 시작하는 틱 — 단계 k 는 유지 + 1 틱 */
function startsOf(durations: readonly number[], last: number): readonly number[] {
  return durations.slice(0, last).reduce<number[]>((starts, duration, index) => [...starts, starts[index] + duration + 1], [0])
}

const PITCH_STEP_STARTS = startsOf(PITCH_STEP_DURATIONS, PITCH_LAST_STEP)

const ACE_PITCH_STEP_STARTS = ACE_PITCH_STEP_DURATIONS.map((durations, row) => startsOf(durations, ACE_PITCH_LAST_STEPS[row]))

function pitchStepStartsOf(aceOrder: number | null | undefined): readonly number[] {
  const row = aceRowOf(aceOrder)
  return row === null ? PITCH_STEP_STARTS : ACE_PITCH_STEP_STARTS[row]
}

export function stepAt(tick: number, starts: readonly number[], lastStep: number): number {
  let step = 0
  while (step < lastStep && tick >= starts[step + 1]) step += 1
  return step
}

/** 상태 1 의 마지막 단계 — 평범한 투수 13, 마투수 0xd744f[u]. 홈런 갈래 0x39096 의 비교 값(13 · 0xcfd34[u])과 같다 */
export function pitchLastStepOf(aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  return row === null ? PITCH_LAST_STEP : ACE_PITCH_LAST_STEPS[row]
}

/** 상태 1 에 든 뒤 틱 → 단계 (0x9df8c 를 그 수만큼 돌린 것 — 마지막 단계에서 멈춘다) */
export function pitchStepAt(tick: number, aceOrder?: number | null): number {
  const starts = pitchStepStartsOf(aceOrder)
  return stepAt(Math.max(0, tick), starts, starts.length - 1)
}

/** 단계 `step` 에 닿는 틱 (상태 1 에 든 뒤) */
export function pitchStepStartTickOf(step: number, aceOrder?: number | null): number {
  const starts = pitchStepStartsOf(aceOrder)
  return starts[Math.min(Math.max(0, step), starts.length - 1)]
}

/**
 * 공 틱이 오르기 시작하는 틱 (상태 1 에 든 뒤) — 투수 단계가 놓는 단계(평범 6 · 마투수 0xcfbe4[u])에 닿는 틱 (0x3f378).
 * 평범한 투수는 11, 마투수는 20 · 23 · 20 · 32 · 24 이다.
 */
export function pitcherReleaseTicksOf(aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  return pitchStepStartTickOf(row === null ? RELEASE_STEP : ACE_RELEASE_STEPS[row], aceOrder)
}

/** 평범한 투수가 공을 놓는 틱 (`pitcherReleaseTicksOf(null)`) */
export const PITCHER_RELEASE_TICKS = pitcherReleaseTicksOf(null)

export const IDLE_STARTS = startsOf(IDLE_DURATIONS, IDLE_LAST_STEP)

/** 대기 한 바퀴의 길이 — 단계 4 에 닿는 그 갱신(9e004)에 상태 0 으로 돌아가므로 단계 4 는 그려지지 않는다 */
export const PITCHER_IDLE_TICKS = IDLE_STARTS[IDLE_END_STEP]
