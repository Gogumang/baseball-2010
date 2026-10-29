import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import type { SwingReservation } from '@/widgets/batting-stage/model/stageRefs'

/** 투구 단계가 부르는 고리 — 타석 화면(`BattingStage`)이 채운다 */
export interface StageHandlers {
  /** 판정 0x6aa(0x51226) — 맞은 공이면 곧 0x13, 아니면 결과를 들고 공 끝까지 기다린다. `tick` 은 그 틀의 장면 틱 */
  readonly judgePitch: (swing: BattingSwing, tick: number) => void
  /** 공 끝(틱 N + 1, 0x4e24e) — 0x12 결과를 세운다 */
  readonly endPitch: (tick: number) => void
  /** 상태 0x13 을 끝내고 인플레이로 넘기는 고리 */
  readonly commitHit: (tick: number) => void
  /** 스윙이 나가는 틱(F + 1, 0x4e0ce) */
  readonly releaseSwing: (swing: SwingReservation) => void
}
