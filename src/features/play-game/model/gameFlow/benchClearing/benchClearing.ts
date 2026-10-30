import type { RandomPort } from '@/shared/api/random/randomPort'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { rollsIntoBenchClearing, benchClearingEffectOf } from '@/entities/game/model/benchClearing'
import { withoutSteal } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { finishPlayerOutcome } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **볼넷 · 사구 · 삼진의 0x12 대기 끝** — 틱 31 갱신 0x4e6d4(4e72c `[+0x2c] ≥ 0x1f`)의 4e74c 벤치 클리어링 굴림(`withBenchClearing` —
 * 사구만, 볼넷 · 삼진은 4e744 st[0xb] == 4 가 거짓이라 굴림 없이 4e78c 판정 A 로 — 삼진은 0xd/0x18 · 정산 0xa8024, r298).
 * 들어갔으면 0x1e 를 예약만 하고(진입 굴림 45 번은 다음 틀 `enterBenchClearing`) 붙든 채 둔다. 안 들어갔으면 판정 A 0xae24c 의
 * 보통 길 — 밀어내기 판(종류 2)을 재생 칸에 넣고 정산한다(예전 공 도착 걸음에 하던 그대로). 대기 중인 사구가 없으면 그대로 돌려준다.
 */
export function judgeHitByPitch(progress: GameProgress, random: RandomPort): GameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'wait') return progress
  const { outcome } = pending
  const held: GameProgress = { ...progress, pendingBenchClearing: null }
  const cleared = withBenchClearing(held, outcome, random)
  if (cleared !== held) return { ...cleared, pendingBenchClearing: { ...pending, phase: 'entry' } }
  // 실시간으로 이미 보여 준 판(`shownLive` — 사람 주루 키를 받은 판)은 재생 칸에 다시 안 넣는다
  const arrival = pending.arrivalPlay ?? null
  const arrivalPlayback = arrival === null || arrival.shownLive === true ? null : arrival.result
  const playback = homeRunPlaybackOf({ outcome, bases: held.game.bases, outs: held.game.outs }) ?? arrivalPlayback
  return finishPlayerOutcome(withoutSteal(held), outcome, random, null, playback)
}

/**
 * **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀. 공격 9명을 흩뿌리며 45 번 굴리고(`rollBenchClearingEntry`)
 * 연출이 끝날 때까지 붙든다. 진입 앞인 사구가 없으면 그대로 돌려준다.
 */
export function enterBenchClearing(progress: GameProgress, random: RandomPort): GameProgress {
  const pending = progress.pendingBenchClearing
  if (pending === null || pending.phase !== 'entry') return progress
  return { ...progress, pendingBenchClearing: { ...pending, phase: 'scene', entryRolls: rollBenchClearingEntry(random) } }
}

/**
 * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (100틱 뒤 화면 전환이 끝났거나 OK·'5' 로 건너뜀).
 *
 * `reachedTargetTick` = 틱 10 의 갱신이 돌았는가. 돌았으면 그때 수비 8명 목표를 굴린 8 번이 나갔다
 * (`benchClearingScene` 머리말) — 화면은 굴림을 직접 하지 않고 여기로 알린다. 그 뒤 사구는 보통 길 그대로다.
 * 아직 0x12 대기 · 진입 앞인 사구(끼어들 사람이 없는 길)는 남은 판정 · 진입을 먼저 돈다 — 안 들어갔으면 판정의 보통 길로 끝난다.
 */
export function resolveBenchClearing(progress: GameProgress, scene: { readonly reachedTargetTick: boolean }, random: RandomPort): GameProgress {
  if (progress.pendingBenchClearing?.phase === 'wait') {
    progress = judgeHitByPitch(progress, random)
    if (progress.pendingBenchClearing === null) return progress
  }
  progress = enterBenchClearing(progress, random)
  const pending = progress.pendingBenchClearing
  if (pending === null) return progress
  if (scene.reachedTargetTick) rollBenchClearingTargets(random)
  const cleared = { ...progress, pendingBenchClearing: null }
  return finishPlayerOutcome(cleared, pending.outcome, random, null, benchClearingPlaybackOf(pending, cleared))
}

/** 출구 0xae24c → 0x17 밀어내기 판 — 연출 뒤에 재생한다 */
function benchClearingPlaybackOf(pending: NonNullable<GameProgress['pendingBenchClearing']>, cleared: GameProgress): DefensePlayResult | null {
  return homeRunPlaybackOf({ outcome: pending.outcome, bases: cleared.game.bases, outs: cleared.game.outs }) ?? pending.arrivalPlay?.result ?? null
}

/**
 * **사구 뒤 벤치 클리어링** (`entities/game/model/benchClearing`, R10 6절).
 * 내 타석이라 수비는 늘 CPU 다 → 들어가면 상대 투수 투구 수(`+0x27c`) +10 (0x3ab82).
 * 시즌 평판 S[1](코드 1)은 게이트상 내 팀이 수비일 때만 남아 여기서는 안 오른다 — 타자편은 S 칸도 안 든다.
 * 홈런더비가 아니므로 사구면 늘 한 번 굴린다 — **사구 타석만 난수를 하나 더 쓴다.**
 * 0x12 대기 끝(`judgeHitByPitch`)이 부른다 — 들어가면 연출(상태 0x1e)을 붙든다(`enterBenchClearing` · `resolveBenchClearing`).
 */
function withBenchClearing(progress: GameProgress, outcome: AtBatOutcome, random: RandomPort): GameProgress {
  const entered = rollsIntoBenchClearing(
    {
      isHitByPitch: outcome.kind === '사구',
      isHomeRunDerby: false,
      burstInProgress: progress.burst !== null && progress.burst.current !== null,
    },
    random,
  )
  if (!entered) return progress
  const effect = benchClearingEffectOf(false)
  return appendLog(
    {
      ...progress,
      opponentMound: {
        ...progress.opponentMound,
        pitches: progress.opponentMound.pitches + effect.defensePitchCountGain,
      },
    },
    `${progress.game.inning}회${progress.game.half} 벤치 클리어링`,
    true,
  )
}
