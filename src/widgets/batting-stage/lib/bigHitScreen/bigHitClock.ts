import { HIT_STOP_TICKS } from '@/widgets/batting-stage/lib/hitPause'

/** 맞을 때 [+0x10a8] 에 적는 값 (5183c) */
export const BIG_HIT_HOLD_COUNTER_START = 6

/** 이 그림의 큰 타구 연출 — 멈춤 갈래(공 틱 0)는 그 그림의 [+0x10a8] 옛값, 뒤 갈래는 애니 3 의 그린 칸 수와 점 */
export type BigHitScreen =
  | { readonly kind: '멈춤'; readonly counter: number; readonly side: number }
  | { readonly kind: '뒤'; readonly drawCall: number; readonly point: { readonly x: number; readonly y: number } | null }

/**
 * **창이 선 첫 그림([창+0x250])의 0x13 그리기** (r175) — 공용 창이 서면 52cc6 이 갱신을 건너뛰지만 창이 선 첫 그림은 52efe 를 지나
 * 그리기 표 0xd05a0 의 0x13 그리기 0x4cb1c 를 한 번 더 돈다(갱신 없이). 그래서 멈춤 갈래(공 틱 0)면 [+0x10a8] 이 한 번 더 줄고(4ccba),
 * 옛값이 음수면 그 그림에서 막음 +0x10a0 을 풀고 016 을 쏜다(4ccc6~4cd14 — 파티클 틱 53048 은 건너뛴다). 뒤 갈래면 애니 3 이 한 칸 더
 * 간다(0x93d91). 공 틱 +1(틀 끝 0x3f378, 53086)은 창이 서 있는 틀에 안 돈다 — 그 그림에서 풀려도 다음 갱신 틀의 그림이 다시 공 틱 0 을
 * 보고 한 번 더 푼다(016 도 한 번 더).
 *
 * `frozenDraws` 는 이 0x13 에서 그런 그림이 든 자리 — 각 값은 그 그림 **앞**에 마지막으로 갱신한 0x13 틱 k(창이 선 뒤 첫 그림은
 * 틱 k + 1 자리의 그림으로 센다). 멈춤 갈래 그림 수가 하나 늘 때마다 [+0x10a8] 이 한 번 더 줄어 막음이 한 틱 일찍 풀린다.
 *
 * 막음을 푸는 갱신 틀의 그림 r = (k + 그 앞 창 그림 수 ≥ 7 인 첫 0x13 틱 k). 창 그림이 없으면 `HIT_STOP_TICKS`(7).
 */
export function bigHitReleaseTickOf(frozenDraws: readonly number[] = []): number {
  for (let tick = 0; ; tick += 1) {
    const extra = frozenDraws.filter((at) => at < tick).length
    if (tick + extra >= HIT_STOP_TICKS) return tick
  }
}

/**
 * 0x13 틱 `stateTick` 의 그림 — 감상 플래그가 꺼진 타구(`watchesBigHit` 거짓)는 4cb7c 에서 끝나 null.
 * `point` 는 타격점의 화면 자리(공 도착점 `platePixelOf` — `BattingStage` 의 `contact`), `side` 는 +0x17e1(타자 손).
 * `frozenDraws` 는 이 그림 앞의 창 첫 그림 자리(`bigHitReleaseTickOf`) — 창이 선 첫 그림은 `stateTick` = 마지막 갱신 틱 + 1 로,
 * 그 그림 앞의 자리만 넘겨 부른다.
 */
export function bigHitScreenOf(
  watchesBigHit: boolean,
  stateTick: number,
  side: number,
  point: { readonly x: number; readonly y: number } | null,
  frozenDraws: readonly number[] = [],
): BigHitScreen | null {
  if (!watchesBigHit || stateTick < 0) return null
  const before = frozenDraws.filter((at) => at < stateTick)
  const releaseTick = bigHitReleaseTickOf(before)
  if (stateTick <= releaseTick) return { kind: '멈춤', counter: BIG_HIT_HOLD_COUNTER_START - stateTick - before.length, side }
  // 애니 3 은 뒤 갈래 그림마다 한 칸(0x93d91) — 막음을 푼 뒤의 창 첫 그림도 센다
  const frozenAfter = before.filter((at) => at >= releaseTick).length
  return { kind: '뒤', drawCall: stateTick - releaseTick - 1 + frozenAfter, point }
}

/**
 * 큰 타구 0x13 이 끝나는 0x13 틱 — 0x406e8 은 `문턱 ≤ 공 틱` 인 첫 갱신에 0x17 을 예약하고, 공 틱은 막음을 푼 그림(r) 뒤 틀 끝마다 오른다
 * (상태 틱 k 의 공 틱 = max(0, k − r)). `pauseTicks` 는 창 그림이 없을 때의 끝(`hitPauseTicksOf` = 문턱 + 7, 문턱 ≤ 0 이면 그 값).
 */
export function bigHitEndTickOf(pauseTicks: number, releaseTick: number): number {
  if (pauseTicks <= HIT_STOP_TICKS) return pauseTicks
  return pauseTicks - HIT_STOP_TICKS + releaseTick
}

/**
 * **0x13 동안 타자 스윙이 멈추고 반 속도로 도는 몫** — 스윙 객체 [+0xf9c] 는 틀 머리 0x3f060 끝(3f320 vt+8)에서만 한 칸 넘어간다
 * (2026-10-24 직접 떴다):
 * ```
 * 3f1dc  상태 0x13 이면: 3f1ea 막음 [+0x10a0] ≠ 0 이면 끝(3f32a) — 스윙도 안 넘어간다
 * 3f2dc  (카메라 뒤) +0x199a ≠ 0 이면 3f2e4 상태 틱 [+0x2c] 이 홀수면 끝, 짝수면 3f320 한 칸 · +0x199a == 0 이면 늘 한 칸
 * ```
 * 막음은 판정 0x51818 이 큰 타구(+0xfd4 ∈ 24~26 && +0x199a)에 세우고 0x13 틱 7 그림이 푼다 — 그래서 큰 타구는 0x13 틱 0~7 에
 * 스윙이 서 있고 틱 8 부터 짝수 틱에만 한 칸 간다. 0x13 이 아닌 상태(3f2f6 갈래)는 늘 한 칸이다.
 *
 * 돌려주는 값은 장면 틱 `sceneTick` 까지 건너뛴 스윙 칸 수 — `hitStartTick` 은 0x13 이 선 장면 틱, `hitEndTick` 은 0x13 다음 상태가 선
 * 장면 틱(아직 0x13 이면 null).
 */
export function bigHitSwingSkipsOf(
  isBigHit: boolean,
  hitStartTick: number,
  hitEndTick: number | null,
  sceneTick: number,
  releaseTick: number = HIT_STOP_TICKS,
): number {
  if (!isBigHit) return 0
  const lastTick = Math.min(sceneTick, hitEndTick === null ? sceneTick : hitEndTick - 1) - hitStartTick
  let skips = 0
  // 막음은 0x13 틱 r 의 그림이 푼다 — 그 틱의 갱신(3f1ea)까지 막혀 있다(창 첫 그림이 r 을 당긴다 — `bigHitReleaseTickOf`)
  for (let tick = 0; tick <= lastTick; tick += 1) {
    if (tick <= releaseTick || tick % 2 === 1) skips += 1
  }
  return skips
}
