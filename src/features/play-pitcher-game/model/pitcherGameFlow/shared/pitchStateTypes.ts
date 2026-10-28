import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'

/* ── 투구 ────────────────────────────────────────────────────────────────────── */

export interface PitchInput {
  /** 원본 구질 번호 1~21, 마구는 22 */
  readonly typeNumber: number
  /**
   * 조준점 x · y · z — 0x10 에서 방향키로 흐른 점(`pitchAim`). 0x4dc78 이 세 칸 그대로 목표로 쓴다.
   * 안 넘기면 0x10 진입 0x39894 의 존 중심(안 움직인 조준점)
   */
  readonly aim?: WorldPoint
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 */
  readonly gaugeCell: number
}

/** 0x12 진입까지 붙든 공 — `pendingPitchArrival` */
export interface PitcherPendingPitchArrival {
  readonly resolution: PitchResolution
  /** 이 공을 먹인 뒤의 타석 결과 (볼넷 · 삼진 · 사구, 아니면 null) */
  readonly outcomeAfter: AtBatOutcome | null
  /** 장면 +0xfdc — CPU 타자의 이 공 번트 종류 */
  readonly buntKind: number
  /** CPU 타자의 손 0xb63c0 (`Pitch.stageSide`) — 밀어내기 · 낫아웃 판의 타자주자 타석 자리 */
  readonly batterHand: number
  /** 이 공의 등급 t (scene+0x17c0) */
  readonly grade: number
  /** 도루 · 폭투 판을 화면이 실시간으로 돌리는 갈래인가 (`startPitch` 의 `live`) */
  readonly live: boolean
}

/**
 * 실시간 주자 판과 판이 끝난 뒤 이어 갈 재료 — 공 도착 판은 `startPitch` 의 나머지를, 견제 판은 `applyPickoffResult` 를 잇는다.
 */
/** 투구 화면의 CPU 도루 출발 표시 (`PitcherGameProgress.stealDisplay`) */
export interface PitcherStealDisplay {
  readonly bases: readonly StealBase[]
  /** 0xf 진입 3d966~3d976 이 이미 지웠다 — 화면은 공이 날거나 0x12 인 동안만 숨긴다 */
  readonly selectionEntered: boolean
}

export type PitcherPendingRunnerPlay = LiveRunnerPlay & { readonly resume?: { readonly buntKind: number } }
