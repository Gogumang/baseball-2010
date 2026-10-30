import { FrameSprite } from '@/shared/ui'
import { animationStepAt, type AnimationStep } from '@/shared/lib/sprite/animationPlayback'
import { useAnimations, useFrameOrigins, type AnimationEntry } from '@/shared/lib/sprite/useFrameOrigins'
import { PLAYER_EFFECT_FRAMES, type PlayerEffectMark } from '@/pages/defense/lib/playerEffectMarks'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'

/**
 * player_effect 한 장 (0xbe8a5 애니 · 0xbe8d5 프레임). 원본 애니 객체는 그림판에 하나씩이라 그릴 때마다(누가 그리든) 한 칸
 * 넘어간다(0x93d91) — 웹은 화면 갱신 수로 칸을 고른다(근사).
 */
export function DefensePlayerEffect({
  mark,
  point,
  update,
}: {
  readonly mark: PlayerEffectMark
  readonly point: { readonly x: number; readonly y: number }
  readonly update: number
}) {
  const origins = useFrameOrigins(PLAYER_EFFECT_FRAMES)
  const animations = useAnimations(PLAYER_EFFECT_FRAMES)
  const step = effectStepOf(mark, animations, update)
  if (step === null) return null
  const { frame } = step
  return (
    <div
      className={styles.actor}
      style={{ left: point.x + step.dx, top: point.y - mark.raise + step.dy }}
      data-testid={`수비-효과-${mark.key}`}
      data-kind={mark.kind}
      data-index={mark.index}
      data-frame={frame}
    >
      <FrameSprite folder={PLAYER_EFFECT_FRAMES} frame={frame} origins={origins} x={0} y={0} />
    </div>
  )
}

/** 'frame'(0xbe8d5)은 그 칸 그대로(밀기 없음), 'anim'(0xbe8a5)은 이번 칸 — 애니가 아직 없으면 null */
function effectStepOf(
  mark: PlayerEffectMark,
  animations: readonly (readonly AnimationEntry[])[] | null,
  update: number,
): Pick<AnimationStep, 'frame' | 'dx' | 'dy'> | null {
  if (mark.kind === 'frame') return { frame: mark.index, dx: 0, dy: 0 }
  return animationStepAt(animations?.[mark.index] ?? [], update)
}
