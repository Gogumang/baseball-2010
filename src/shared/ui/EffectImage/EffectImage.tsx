import type { CSSProperties } from 'react'
import { color565Of } from '@/shared/lib/pixelEffect/pixelEffect'
import { useEffectSpriteUrl } from '@/shared/lib/pixelEffect/useEffectSpriteUrl'

interface EffectImageProps {
  readonly src: string
  /** 화면을 안 보는 그리기 효과(0xa 회색 · 0xb 단색 · 0xc 반반 · 0xd 색 더하기) — `null` 이면 그대로 그린다 */
  readonly effect: number | null
  readonly argument?: number
  /**
   * 그림 아래 화면이 한 가지 색일 때 그 CSS 색 — 주면 화면을 보는 효과(1 반투명 · 2 더하기)도 그 색 위에 원본 식으로 섞는다.
   * 그림이 덮는 칸이 모두 이 색 위여야 맞다(아니면 쓰지 않는다).
   */
  readonly backdrop?: string
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * 그리기 효과를 원본 픽셀 식(`shared/lib/pixelEffect`, 565 내림까지)으로 칠한 `<img>`.
 * 칠하는 동안은 안 그린다 — 칠하기 전 색이 한 번 비치지 않게.
 */
export function EffectImage({ src, effect, argument = 0, backdrop, className, style }: EffectImageProps) {
  const backdrop565 = backdrop === undefined ? null : color565Of(backdrop)
  const painted = useEffectSpriteUrl(effect === null ? null : src, effect ?? 0, argument, backdrop565)
  const shown = effect === null ? src : painted
  if (shown === null) return null
  return <img className={className} alt="" src={shown} style={style} data-effect={effect ?? undefined} />
}
