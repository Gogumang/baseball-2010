import type { CSSProperties, ImgHTMLAttributes } from 'react'
import { useOriginalScaledImage } from '@/shared/lib/sprite/useOriginalScaledImage'

interface OriginalScaledImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'style'> {
  readonly src: string
  /** 0x662dc 의 폭 · 높이 인자 (팀 로고 0x23 · 0x22) */
  readonly boxWidth: number
  readonly boxHeight: number
  /** 자리(left · top 따위). 폭 · 높이는 줄인 버퍼 크기로 덮어쓴다 */
  readonly style?: CSSProperties
}

/**
 * 원본 식(0x662dc → 0x65f64)으로 미리 줄인 그림을 제 크기로 찍는다 — 0x66431 이 버퍼를 (폭 [+0], 높이 [+4]) 그대로 찍는 것과 같다.
 * 줄이기 전에는 원본 그림을 폭 × 높이 로 늘려 보인다(`useOriginalScaledImage`).
 */
export function OriginalScaledImage({ src, boxWidth, boxHeight, style, alt, ...rest }: OriginalScaledImageProps) {
  const scaled = useOriginalScaledImage(src, boxWidth, boxHeight)
  return (
    <img
      {...rest}
      alt={alt}
      src={scaled.src}
      data-original-scaled={scaled.src === src ? undefined : 'true'}
      style={{ ...style, width: scaled.width, height: scaled.height }}
    />
  )
}
