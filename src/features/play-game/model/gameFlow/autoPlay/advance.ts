import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPlayerTurn, ourHalfOf } from '@/entities/game/model/gameState'
import { prepareMyAtBat } from '@/features/play-game/model/gameFlow/atBat/pitchSelection'
import { withAutoStopLateInningSetup } from '@/features/play-game/model/gameFlow/autoPlay/lateInning'
import { playOpponentInning } from '@/features/play-game/model/gameFlow/autoPlay/opponentInning'
import { playTeammateAtBat } from '@/features/play-game/model/gameFlow/autoPlay/teammateAtBat'
import { withoutPendingBurst } from '@/features/play-game/model/gameFlow/burst/burst'
import { MAXIMUM_AUTO_STEPS } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 상대 공격과 동료 타석을 플레이어 차례가 돌아올 때까지 자동으로 소화한다. */
export function advanceUntilPlayerTurn(progress: GameProgress, random: RandomPort): GameProgress {
  let current = progress
  // 이번 부름에서 자동진행(0x21)으로 한 타석이라도 돌렸는가 — 0x21 이 멈출 때만 0xc22b4 를 부른다
  let autoPlayed = false
  /** 이번 부름의 자동진행 중계 틱들 — 사람 장면에 닿으면 싣는다 */
  const relay: GameAutoRelayTick[] = []
  const settle = (next: GameProgress): GameProgress =>
    relay.length === 0 ? next : { ...next, autoRelay: { serial: (progress.autoRelay?.serial ?? 0) + 1, ticks: relay } }

  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return settle(current)
    // 내 타석이 오면 그 자리가 곧 타석 준비(0xf)다 — 돌발을 굴리고 넘긴다.
    // 자동진행이 내 차례에서 멈췄으면(경기 끝이 아니므로) 먼저 0xc0ee8·0xc22b4 를 지난다 (0x48558~0x48564)
    if (isPlayerTurn(current.game)) {
      return settle(prepareMyAtBat(autoPlayed ? withAutoStopLateInningSetup(current, random) : current, random))
    }
    autoPlayed = true
    // 내 차례가 아니면 원본은 자동진행(0x21)이다 — 진입 0x3abf0 이 남은 돌발을 판정 없이 내린다 (0x8f628).
    // 동료·상대 타석은 0xf 를 안 지나므로 돌발을 굴리지도 판정하지도 않는다 (`burstContextOf` 머리말)
    current = withoutPendingBurst(current)
    // 우리가 공격하는 반 이닝은 측이 정한다 — '초' 고정이 아니다 (측 0 선공 · 측 1 후공)
    current = current.game.half === ourHalfOf(current.game) ? playTeammateAtBat(current, random, relay) : playOpponentInning(current, random, relay)
  }
  throw new Error('경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}
