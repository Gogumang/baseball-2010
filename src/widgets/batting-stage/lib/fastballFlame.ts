import type { Pitch } from '@/entities/pitching/model/pitch'
import { isStrikeZonePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { judgeFrameAt } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * **강속구 불꽃** — game_effect(게임+0x102c) 애니 1 (R2 3-1). 타석 공 그리기 0x3b2f4 의 꼬리 0x3b6e4~0x3b7d8 (직접 뜸):
 * ```
 * 3b6e4  상태 [+0x1c] − 0x11 > 1 이면 끝            ; 0x11(공 비행) · 0x12(안 친 공 결과)만 — 0x13(맞힌 공)은 없다
 * 3b6fc  공 틱 [+0x1098] < N [+0x109c] 이면 끝        ; 공이 다 온 틱부터
 * 3b70a  상자 = 표 0xcfb7c[+0x17e1] · 점 ([+0x10dc], [+0x10e0])  ; x ≤ px ≤ x+w · y ≤ py ≤ y+h (스트라이크 판정 0x3dfac 와 같은 상자·점)
 * 3b782  L = 0x94071(애니 1) = Σ max(1, 지연 + 보정)   ; 애니 1 = 12(2) 13 14 15 16 17(1) 21(0→1) → 8
 * 3b794  공 틱 − N > L 이면 끝
 * 3b7a4  표시 구속 [+0x19a0] ≤ 0x97(151) 이면 끝        ; 152 km/h 부터
 * 3b7ce  0xbe8a5(게임+0x234, 공 화면 x [sp+0x4c], y [sp+0x50], 겹, game_effect, 애니 1, 0, 0, 1, 0, −1)
 * 3b7d6  0x93d91(애니 1)                               ; 그린 틱에만 한 칸 넘어간다
 * ```
 * - 공 틱은 0x12 에서도 장면 틱 0x3f378(3f450)이 계속 +1 하고, 공 자리 0x35820 은 틱을 N − 1 로 잘라 **마지막 점**에 둔다.
 * - 애니 1 은 공마다 0x10 진입 0x39894 가 되감는다. 다른 곳은 이 애니를 안 돌려서 그린 틱 수 = 공 틱 − N 이다.
 *   끝 칸 21 은 그림이 없다(빈 칸) — 끝에 닿으면 그 칸에 머문다(`judgeFrameAt`).
 * - 같은 0x3b2f4 안에서 공(3b6e0) **다음**에 그려 공 위에 얹힌다.
 */

/** 3b7a4 `cmp r3, #0x97 / ble` — 이 값을 **넘어야** 불꽃 */
export const FASTBALL_FLAME_SPEED_THRESHOLD = 151
/** game_effect 애니 번호 (0xbe8a5 다섯째 인자 · 0x3b780 [애니표 +4]) */
export const FASTBALL_FLAME_ANIMATION = 1

interface AnimationEntry {
  readonly frame: number
  readonly delay: number
}

/** 0x94071 — 애니 전체 길이 (칸마다 max(1, 지연)) */
export function animationLengthOf(entries: readonly AnimationEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
}

/**
 * 원본 공 틱 [+0x1098] — '투구중'(0x11)은 웹 공 프레임 그대로, 안 친 공 '결과'(0x12)는 공 끝 틱 N + 1(0x4e24e)부터 단계 틱만큼 더 간다.
 * ⚠️ 근사: 웹 '결과' 는 공 끝을 본 rAF 시각에서 단계 틱을 다시 세므로 한 틱 안쪽으로 어긋날 수 있다.
 * 그 밖(대기 · 0x13 타격 · 인플레이 결과)은 null — 불꽃을 안 그린다.
 */
export function fastballFlameBallTickOf(
  phase: StagePhaseSnapshot | undefined,
  ballFrame: number,
  frameCount: number,
): number | null {
  if (phase === undefined) return null
  if (phase.kind === '투구중') return ballFrame
  if (phase.kind === '결과' && phase.isInPlay !== true) return frameCount + 1 + phase.tick
  return null
}

/** 3b7a4 · 3b70a — 공이 불꽃을 달 수 있는가 (표시 구속 > 151 · 도착점이 존 상자 안) */
export function hasFastballFlame(pitch: Pitch): boolean {
  return (pitch.displaySpeedKmh ?? 0) > FASTBALL_FLAME_SPEED_THRESHOLD && isStrikeZonePitch(pitch)
}

/**
 * 이 공 틱에 그릴 game_effect 그림 번호 — 3b6fc · 3b794 를 지나면 애니 1 의 (공 틱 − N) 번째 틱 칸, 아니면 null
 */
export function fastballFlameFrameAt(
  entries: readonly AnimationEntry[],
  ballTick: number,
  frameCount: number,
): number | null {
  const elapsed = ballTick - frameCount
  if (elapsed < 0 || elapsed > animationLengthOf(entries)) return null
  return judgeFrameAt(entries, elapsed)
}
