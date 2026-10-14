import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { frameAnimations, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'

/**
 * **지친 투수 표시** — 타석 화면 투수 그리기 0x38d1c 의 0x38f42~0x39030 (R2 4-1 · 2026-10-14 다시 뜸).
 *
 * 원본은 체력을 막대나 숫자로 그리지 않는다. 투수 몸 위에 player_effect(장면 +0x1030) 애니를 얹을 뿐이다:
 * ```
 * 38f42  상태 [+0x1c] == 0x16(교체 연출) → 건너뜀
 * 38f4a  투수 그림 객체 [+0xf98] 의 +0x14(투구 동작 상태) ≠ 0 → 건너뜀            ; 서서 기다릴 때만
 * 38f56  0xb633d(지금 투수) ≠ 0(마투수) → 건너뜀
 * 38f68  체력% = 0xaebb1([+0x224]) — 수비 팀 마운드 투수 +0x2c ÷ 100 (모드 7 은 늘 100)
 *        ≤ 19 → 애니 10 (46~49) · 20~34 → 애니 9 (42~45) · 그 밖 → 안 그림
 * 38fb4  0xbe8a5(그리기 목록, x, y, 깊이 [0xcfa8c+8], player_effect, 애니, 좌투면 효과 0x11, …) — 투수 그림과 같은 점
 *        그린 뒤 그 애니를 0x93d91 로 한 칸 넘긴다
 * ```
 * 애니 9 · 10 은 0xf 진입 0x3d954 가 player_effect 애니를 모두 되감을 때(3daba~3db1c) 되풀이 비트 표 0x1a610 에 든다 —
 * 그래서 0xf 마다 첫 칸부터 돌고 끝나면 처음으로 돈다.
 *
 * ⚠️ 0x3493c(체력% ÷ 25 를 3 에서 자른 0~3 단계)는 .text 전체에서 부르는 곳이 없다(BL · 리터럴 풀 모두 0곳) — 원본 화면에
 *    체력 4단계 표시는 없다.
 * ⚠️ 근사: 애니 칸은 그린 횟수가 아니라 0xf 진입 뒤 장면 틱으로 센다.
 */

const PLAYER_EFFECT_FRAMES = './sprites/player_effect/frames'

/** 체력% 문턱 — 38f70 `cmp #0x13 · bgt` · 38fce `cmp #0x22 · bgt` */
const EXHAUSTED_MAX_PERCENT = 19
const TIRED_MAX_PERCENT = 34
const EXHAUSTED_ANIMATION = 10
const TIRED_ANIMATION = 9

/** 체력% → player_effect 애니 번호 (안 그리면 null) */
export function tiredEffectAnimationOf(staminaPercent: number): number | null {
  if (staminaPercent <= EXHAUSTED_MAX_PERCENT) return EXHAUSTED_ANIMATION
  if (staminaPercent <= TIRED_MAX_PERCENT) return TIRED_ANIMATION
  return null
}

export interface PitcherTiredEffect {
  /** player_effect 애니 번호 (9 · 10) */
  readonly animation: number
  /** 0xf 진입 뒤 넘긴 칸 수 */
  readonly step: number
}

/**
 * 투수 그림과 같은 점(앵커 · 좌투 거울 축)에 애니를 그린다 — 부르는 쪽(`renderBattingStage`)이 투수 그림에 쓴 축을 넘긴다.
 */
export function drawPitcherTiredEffect(
  context: CanvasRenderingContext2D,
  effect: PitcherTiredEffect,
  mirror: { readonly axisX: number; readonly isMirrored: boolean },
  anchorY: number,
): void {
  const entries = frameAnimations(PLAYER_EFFECT_FRAMES)?.[effect.animation]
  const step = entries === undefined ? null : animationStepAt(entries, effect.step)
  if (step === null) return
  const placed = placedFrame(PLAYER_EFFECT_FRAMES, step.frame)
  if (placed === null) return
  context.save()
  if (mirror.isMirrored) {
    context.translate(mirror.axisX * 2, 0)
    context.scale(-1, 1)
  }
  context.drawImage(placed.image, mirror.axisX + placed.offsetX + step.dx, anchorY + placed.offsetY + step.dy)
  context.restore()
}
