import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollBenchClearingTargets, rollBenchClearingEntry } from '@/features/play-game/model/benchClearingScene'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { finishBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/finishBatterOutcome'
import { withBatterBenchClearing, withPitcherBenchClearing } from '@/features/play-team-game/model/teamGameFlow/benchClearing/benchClearingEffects'
import { startDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/defensiveAtBat'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 * `reachedTargetTick` = 틱 10 의 갱신이 돌았는가 — 돌았으면 수비 8명 목표 굴림 8 번이 그때 나갔다
 * (`features/play-game/model/benchClearingScene`). 그 뒤 사구는 보통 길 그대로다.
 */
export function resolveBenchClearing(
  progress: TeamGameProgress,
  scene: { readonly reachedTargetTick: boolean },
  random: RandomPort,
): TeamGameProgress {
  // 아직 0x12 대기 · 진입 앞인 사구(끼어들 사람이 없는 길)는 남은 판정 · 진입을 먼저 돈다 — 안 들어갔으면 판정의 보통 길로 끝난다
  if (progress.pendingBenchClearing?.phase === 'wait') {
    progress = judgeHitByPitch(progress, random)
    if (progress.pendingBenchClearing === null) return progress
  }
  progress = enterBenchClearing(progress, random)
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  // 출구 0xae24c → 0x17 밀어내기 판 — 연출 뒤에 재생한다
  return finishHeldHitByPitch({ ...progress, pendingBenchClearing: null }, pending, random)
}

/**
 * **볼넷 · 사구 · 삼진의 0x12 대기 끝** — 틱 31 갱신 0x4e6d4(4e72c `[+0x2c] ≥ 0x1f`)의 4e74c 벤치 클리어링 굴림(사구만 — 사람이 공격이면
 * `withBatterBenchClearing`, 수비면 `withPitcherBenchClearing`). 들어갔으면 0x1e 를 예약만 하고(진입 굴림 45 번은 다음 틀
 * `enterBenchClearing`) 붙든 채 둔다. 안 들어갔으면 판정 A 0xae24c 의 보통 길 — 예전 공 도착 걸음에 하던 그대로다.
 * 대기 중인 사구가 없으면 그대로 돌려준다.
 */
export function judgeHitByPitch(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'wait') return progress
  const held: TeamGameProgress = { ...progress, pendingBenchClearing: null }
  const cleared =
    pending.side === '공격' ? withBatterBenchClearing(held, pending.outcome, random) : withPitcherBenchClearing(held, pending.outcome, random)
  if (cleared !== held) return { ...cleared, pendingBenchClearing: { ...pending, phase: 'entry' } }
  return finishHeldHitByPitch(held, pending, random)
}

/**
 * **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀. 공격 9명을 흩뿌리며 45 번 굴리고(`rollBenchClearingEntry`)
 * 연출이 끝날 때까지 붙든다. 진입 앞인 사구가 없으면 그대로 돌려준다.
 */
export function enterBenchClearing(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'entry') return progress
  return { ...progress, pendingBenchClearing: { ...pending, phase: 'scene', entryRolls: rollBenchClearingEntry(random) } }
}

/**
 * 붙든 볼넷 · 사구 · 삼진의 판정 A 0xae24c 보통 길 — 밀어내기 판(종류 2)을 재생 칸에 넣고 정산 · 다음 사람 차례까지
 * (`cleared` 는 칸을 비운 진행). 삼진은 판이 없어 정산 0xa8024 · 다음 타석(0xd) · 3아웃이면 0x18 뿐이다(r298)
 */
function finishHeldHitByPitch(
  cleared: TeamGameProgress,
  pending: NonNullable<TeamGameProgress['pendingBenchClearing']>,
  random: RandomPort,
): TeamGameProgress {
  const arrival = pending.arrivalPlay ?? null
  if (pending.side === '공격') {
    const playback = homeRunPlaybackOf({ outcome: pending.outcome, bases: cleared.game.bases, outs: cleared.game.outs }) ?? arrival?.result ?? null
    return finishBatterOutcome(cleared, pending.outcome, random, null, playback)
  }
  // 볼넷 · 사구 · 삼진은 인플레이가 아니라 타구 판 없이 곧장 끝난다 — 밀어내기 판(종류 2)만 재생한다
  return advance(startDefensiveAtBat(cleared, pending.outcome, true, random, false, arrival), random)
}
