import { bigHitEndTickOf, bigHitReleaseTickOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { HUMAN_PITCH_RELEASE_STATE_TICK, type PitcherHitClock } from '@/widgets/batting-stage/lib/pitcherSideStage/stageClock'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * 0x13 이 0x17 을 예약하는 상태 틱 — 0x406e8: 큰 타구면 `문턱 ≤ 공 틱`(멈춤 포함 `hitPauseTicksOf`), 아니면 틱 8 · 이른 넘김.
 * 큰 타구는 OK(−5) · '5' 를 읽은 틱(40708~40712)에도 넘긴다 — 그 틱이 더 이르면 그 틱. 0 아래는 진입 틀(0)이다.
 */
export function hitEndTickOf(hit: PitcherHitClock): number {
  const skip = hit.skipTick ?? null
  // 창 첫 그림이 막음을 당긴 만큼 공 틱이 일찍 올라 문턱에 일찍 닿는다(`bigHitEndTickOf` — 타자편 `useStageAnimation` 과 같은 셈).
  // 창 첫 그림은 큰 타구에서만 적으므로 아니면 그대로다
  const ticks = bigHitEndTickOf(hit.ticks, bigHitReleaseTickOf(hit.frozenDraws ?? []))
  const end = skip === null ? ticks : Math.min(ticks, skip)
  return Math.max(0, end)
}

/**
 * 공을 놓은 틱(0x11 틱 10)에서 0x17 틱 0 까지 — 남은 0x11(판정 틀 J 까지) + 0x13(`hitEndTickOf` + 1 그림). 부르는 화면이 수비 판을
 * 띄우는 틱이다 (`pitcherSideStageFrameOf` 와 같은 셈)
 */
export function pitchHitSceneTicksOf(hit: PitcherHitClock, aceOrder?: number | null): number {
  return pitcherReleaseTicksOf(aceOrder) - HUMAN_PITCH_RELEASE_STATE_TICK + hit.judgeBallTick + 1 + hitEndTickOf(hit) + 1
}
