import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **볼넷 · 사구 · 판 없는 삼진을 0x12 대기 끝까지 붙든다** — 공 도착 0x3dfac 은 0x12 를 예약할 뿐이다. 벤치 클리어링 굴림(4e74c,
 * 사구만)·판정 A 의 밀어내기 주루 · 정산(삼진은 0xd · 0x18 과 0xa8024)은 0x12 의 32 그림 뒤라 그동안 붙든다(그 그림들의 입자
 * 굴림이 먼저 난다 — `judgeHitByPitch`, A-22 · r295 · r298). 이 공이 연 판이 있으면 함께 든다
 */
export function withResultWaitHold(
  progress: TeamGameProgress,
  side: ControlSide,
  outcome: AtBatOutcome,
  arrivalPlay: PitchArrivalPlay | null,
): TeamGameProgress {
  const pendingBenchClearing =
    arrivalPlay === null ? { phase: 'wait' as const, side, outcome } : { phase: 'wait' as const, side, outcome, arrivalPlay }
  return { ...progress, pendingBenchClearing }
}
