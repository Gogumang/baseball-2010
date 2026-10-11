import { FrameSprite } from '@/shared/ui'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
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
  const step = mark.kind === 'anim' ? animationStepAt(animations?.[mark.index] ?? [], update) : null
  const frame = mark.kind === 'frame' ? mark.index : step?.frame
  if (frame === undefined) return null
  return (
    <div
      className={styles.actor}
      style={{ left: point.x + (step?.dx ?? 0), top: point.y - mark.raise + (step?.dy ?? 0) }}
      data-testid={`수비-효과-${mark.key}`}
      data-kind={mark.kind}
      data-index={mark.index}
      data-frame={frame}
    >
      <FrameSprite folder={PLAYER_EFFECT_FRAMES} frame={frame} origins={origins} x={0} y={0} />
    </div>
  )
}
