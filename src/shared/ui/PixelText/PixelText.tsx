import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'
import { FONT_SPACING, layoutPixelText } from '@/shared/lib/font/layout'
import type { PlacedPiece } from '@/shared/lib/font/layout'
import * as styles from '@/shared/ui/PixelText/PixelText.css'

/**
 * 원본 비트맵 글꼴로 글을 찍는다.
 *
 * 웹판은 지금까지 Galmuri 웹폰트로 글을 그려서 글자 모양·자간·줄간이 원본과 달랐다.
 * 이 컴포넌트는 원본 synGak9_11.ft2 / synGulimAsc5_11.ft2 조각을 그대로 찍는다 —
 * 2350자 밖 글자(뷁 등)와 전각 숫자·대부분의 기호가 **원본처럼 사라지는 것**까지 같다.
 *
 * 쓰는 법:
 * ```tsx
 * import { PixelText } from '@/shared/ui/PixelText/PixelText'
 *
 * <PixelText>{'게임빌 2010 프로야구'}</PixelText>          // 앱 전역 글꼴 (자간 1 · 줄간 3)
 * <PixelText spacing="textBox">{'홈런!'}</PixelText>        // 글상자 글꼴 (자간 2 · 줄간 2)
 * <PixelText maxWidth={220} scale={2} style={{ color: '#ffe680' }}>{긴글}</PixelText>
 * ```
 * 색은 CSS `color` 를 따른다 (원본 기본값은 흰색 0xFFFF).
 *
 * ⚠️ 아직 기존 화면에 끼우지 않았다. 갈아 끼우는 일은 따로 한다.
 */

interface PixelTextProps {
  readonly children: string
  /**
   * 어느 글꼴 객체의 자간·줄간을 쓸지.
   *
   * ⚠️ **어느 화면이 무엇을 쓰는지는 해독 문서도 미확인이다** (R5 5절 "남은 것").
   * 문서의 유력한 추측이 "게임 전역 글꼴 = 자간 1" 이라 'app' 을 기본값으로 둔다.
   */
  readonly spacing?: keyof typeof FONT_SPACING
  /** 자간을 직접 주면 spacing 보다 우선한다 */
  readonly letterGap?: number
  readonly lineGap?: number
  /** 0 보다 크면 이 폭(원본 픽셀)에서 줄을 접는다 */
  readonly maxWidth?: number
  /** 줄 첫머리 공백을 버린다 (원본 0x9c068 의 [sp+0x50] 플래그) */
  readonly skipLeadingSpace?: boolean
  /**
   * 정수 배율. 도트 그림이라 1·2·3 처럼 정수만 써야 깨지지 않는다.
   * 마스크 그림 확대에 image-rendering 이 안 먹는 브라우저가 있을 수 있어 **이 부분은 근사다** —
   * 원본 그대로 찍으려면 scale=1 로 두고 바깥 화면 쪽에서 통째로 키우는 편이 안전하다.
   */
  readonly scale?: number
  readonly className?: string
  readonly style?: CSSProperties
}

const ATLAS_URL = { hangul: HANGUL_ATLAS.atlas, ascii: ASCII_ATLAS.atlas } as const
const ATLAS_SIZE = {
  hangul: [HANGUL_ATLAS.atlasWidth, HANGUL_ATLAS.atlasHeight],
  ascii: [ASCII_ATLAS.atlasWidth, ASCII_ATLAS.atlasHeight],
} as const

/**
 * 조각 한 칸을 아틀라스에서 떠 오는 마스크 스타일.
 *
 * jsdom 은 mask-* 를 아예 버려서 DOM 으로는 확인할 수 없다. 그래서 따로 빼 두고 값만 테스트한다.
 * webkit 접두사를 같이 다는 건 구형 사파리·웹뷰 때문이다.
 */
export function pieceMaskStyle(piece: PlacedPiece, scale: number): CSSProperties {
  const [atlasWidth, atlasHeight] = ATLAS_SIZE[piece.atlas]
  const image = `url(${ATLAS_URL[piece.atlas]})`
  const size = `${atlasWidth * scale}px ${atlasHeight * scale}px`
  const position = `${-piece.column * piece.width * scale}px ${-piece.row * piece.height * scale}px`
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
  }
}

export function PixelText({
  children,
  spacing = 'app',
  letterGap,
  lineGap,
  maxWidth = 0,
  skipLeadingSpace = false,
  scale = 1,
  className,
  style,
}: PixelTextProps) {
  const gaps = FONT_SPACING[spacing]
  const layout = useMemo(
    () => layoutPixelText(children, {
      letterGap: letterGap ?? gaps.letterGap,
      lineGap: lineGap ?? gaps.lineGap,
      maxWidth,
      skipLeadingSpace,
    }),
    [children, letterGap, lineGap, gaps, maxWidth, skipLeadingSpace],
  )

  return (
    <span
      className={className === undefined ? styles.text : `${styles.text} ${className}`}
      style={{ width: layout.width * scale, height: layout.height * scale, ...style }}
      role="img"
      aria-label={children}
    >
      {layout.pieces.map((piece, index) => (
        <span
          key={index}
          className={styles.piece}
          data-atlas={piece.atlas}
          style={{
            left: piece.x * scale,
            top: piece.y * scale,
            width: piece.width * scale,
            height: piece.height * scale,
            ...pieceMaskStyle(piece, scale),
          }}
        />
      ))}
    </span>
  )
}
