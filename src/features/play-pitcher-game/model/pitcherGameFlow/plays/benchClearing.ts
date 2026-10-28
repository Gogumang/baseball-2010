import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { benchClearingEffectOf, rollsIntoBenchClearing, staminaAfterBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { finishNonPlayOutcome } from '@/features/play-pitcher-game/model/pitcherGameFlow/plays/nonPlayOutcome'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * **볼넷 · 사구 · 삼진의 0x12 대기 끝** — 틱 31 갱신 0x4e6d4(4e72c `[+0x2c] ≥ 0x1f`)의 4e74c 벤치 클리어링 굴림
 * (`withPitcherBenchClearing` — 사구만. 볼넷 · 삼진은 굴림 없이 4e78c 판정 A — 삼진은 0xd/0x18 · 정산 0xa8024, r298).
 * 들어갔으면 0x1e 를 예약만 하고(진입 굴림 45 번은 다음 틀 `enterBenchClearing`) 붙든 채 둔다. 안 들어갔으면 판정 A 0xae24c 의
 * 보통 길(밀어내기 판 재생 · 정산 · 다음 사람 차례까지) — 예전 공 도착 걸음에 하던 그대로다. 대기 중인 사구가 없으면 그대로 돌려준다.
 */
export function judgeHitByPitch(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'wait') return progress
  const held: PitcherGameProgress = { ...progress, pendingBenchClearing: null }
  const settled = withPitcherBenchClearing(held, pending.outcome, random)
  if (settled !== held) return { ...settled, pendingBenchClearing: { ...pending, phase: 'entry' } }
  return finishNonPlayOutcome(held, pending.outcome, random, pending.arrivalPlay ?? null)
}

/**
 * **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀. 공격 9명을 흩뿌리며 45 번 굴리고(`rollBenchClearingEntry`)
 * 연출이 끝날 때까지 붙든다. 진입 앞인 사구가 없으면 그대로 돌려준다.
 */
export function enterBenchClearing(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'entry') return progress
  return { ...progress, pendingBenchClearing: { ...pending, phase: 'scene', entryRolls: rollBenchClearingEntry(random) } }
}

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 *
 * `reachedTargetTick` = 틱 10 의 갱신(0x401d4)이 돌았는가. 돌았으면 그때 수비 8명 목표를 굴린 8 번이 나갔다
 * (`features/play-game/model/benchClearingScene` 머리말) — 화면은 굴림을 직접 하지 않고 여기로 알린다.
 * 그 뒤 사구는 보통 길 그대로다(밀어내기 주루·R+0x148 사구 칸·다음 타석).
 */
export function resolveBenchClearing(
  progress: PitcherGameProgress,
  scene: { readonly reachedTargetTick: boolean },
  random: RandomPort,
): PitcherGameProgress {
  // 아직 0x12 대기 · 진입 앞인 사구(끼어들 사람이 없는 길)는 남은 판정 · 진입을 먼저 돈다 — 안 들어갔으면 판정의 보통 길로 끝난다
  if (progress.pendingBenchClearing?.phase === 'wait') {
    progress = judgeHitByPitch(progress, random)
    if (progress.pendingBenchClearing === null) return progress
  }
  progress = enterBenchClearing(progress, random)
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  return finishNonPlayOutcome({ ...progress, pendingBenchClearing: null }, pending.outcome, random, pending.arrivalPlay ?? null)
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절) — 내가 던진 공이라 수비는 사람(나)이다.
 * 들어가면 0x3ab7c `0xaeab0(수비 팀, 1000)` — 지금 마운드의 내 스태미나(+0x2c) −1000, [0, 10000] 로 자른다.
 * 시즌 평판 S[1](0xa755c(ctx, 1), 0x3ab92)도 부르지만 그 게이트는 **모드 2(시즌)** 만 적으므로 투수편(모드 3)에서는
 * 아무것도 안 남는다. 홈런더비가 아니라 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 0x12 대기 끝(`judgeHitByPitch`)이 부른다 — 들어가면 연출(상태 0x1e)을 붙든다(`enterBenchClearing` · `resolveBenchClearing`).
 */
function withPitcherBenchClearing(progress: PitcherGameProgress, outcome: AtBatOutcome, random: RandomPort): PitcherGameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(true)
  return appendLog(
    { ...progress, stamina: staminaAfterBenchClearing(progress.stamina, effect.defenseStaminaLoss) },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}
