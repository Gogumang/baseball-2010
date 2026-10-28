import { cancelBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **남은 돌발을 판정 없이 내린다** — `0x8f628` (`cancelBurst`, 굴림 없음 · obj+0x21c·+0xc 만 −1).
 * 부르는 곳은 상태 0x21(자동진행) 진입 `0x3abf0` 과 0x18 뒤집힘 진입 `0x3ac90` 둘뿐이다.
 * 돌발 객체는 시즌(모드 2)에만 있어 다른 모드에서는 아무 일도 없다.
 */
export function withoutPendingBurst(progress: TeamGameProgress): TeamGameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}

/**
 * 상태 0x18 진입 `0x3ac90` — 경기가 안 끝났고 `0xb6b6c`(아웃 > 2 → 초/말 뒤집기)가 참이면 `0x8f628`.
 * 사람이 잡은 마지막 반 이닝(`lastHumanHalf`)과 지금 반 이닝이 다르면 그 사이에 뒤집힘이 있었다
 * (그 사이 자동 타석이 있었으면 0x21 진입이 이미 내렸다 — 두 번 내려도 같다).
 */
export function withoutBurstOnHalfFlip(progress: TeamGameProgress): TeamGameProgress {
  const last = progress.lastHumanHalf
  if (last === null || isSameHalfInning(last, progress.game)) return progress
  return withoutPendingBurst(progress)
}
