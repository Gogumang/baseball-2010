import { opponentHalfOf } from '@/entities/game/model/gameState'
import { type PitchSlot, pitchSlotsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 지금 사람이 공을 던질 차례인가 (0xc1d38).
 *
 * 수비 화면이 도는 동안(`pendingDefensePlay` 가 차 있는 동안)은 거짓이다 — 원본도 상태 0x17 을
 * 도는 중에는 0xf(구질 고르기)로 돌아가지 않아 다음 공이 나가지 않는다.
 */
export function isPitchTurn(progress: PitcherGameProgress): boolean {
  return (
    !progress.game.isFinished &&
    progress.onMound &&
    progress.managerHookText === null &&
    progress.pendingDefensePlay === null &&
    // 내가 수비하는 주자 판(상태 0x17)이 도는 동안도
    progress.pendingRunnerPlay == null &&
    // 벤치 클리어링 연출(0x1e)이 도는 동안도 0xf 로 안 돌아간다
    progress.pendingBenchClearing === null &&
    progress.game.half === opponentHalfOf(progress.game)
  )
}

/** 고를 수 있는 구질 칸 여섯 (0xb6d2c) */
export function pitchSlotsFor(progress: PitcherGameProgress): readonly PitchSlot[] {
  return pitchSlotsOf(progress.options.repertoire)
}
