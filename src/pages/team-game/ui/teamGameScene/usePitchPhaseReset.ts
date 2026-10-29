import { useState } from 'react'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { PitchPhase } from './teamGameSceneProps'

/**
 * 타석·차례가 바뀌면 투구 1단계로 되돌린다 — 던질 수 있음 · 볼 · 스트라이크가 바뀐 렌더에서 맞춘다(투수편 `PitcherGameScene` 과 같다)
 */
export function usePitchPhaseReset(canPitch: boolean, progress: TeamGameProgress, setPhase: (phase: PitchPhase) => void) {
  const countKey = `${canPitch}:${progress.atBat.balls}:${progress.atBat.strikes}`
  const [seenCountKey, setSeenCountKey] = useState<string | null>(null)
  if (seenCountKey !== countKey) {
    setSeenCountKey(countKey)
    if (canPitch && progress.atBat.balls === 0 && progress.atBat.strikes === 0) setPhase('구질')
  }
}
