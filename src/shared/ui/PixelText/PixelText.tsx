import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'
import { FONT_SPACING, layoutPixelText } from '@/shared/lib/font/layout'
import type { PlacedPiece } from '@/shared/lib/font/layout'
import * as styles from '@/shared/ui/PixelText/PixelText.css'
import { solidColorCss } from '@/shared/lib/pixelEffect/pixelEffect'

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
 */

interface PixelTextProps {
  readonly children: string
  /**
   * 어느 글꼴 객체의 자간·줄간을 쓸지.
   *
   * 공용 글 그리기 0xba269 는 늘 앱 전역 글꼴 `[[0x1400070]+0x3c]`(자간 1)을 쓰고(0xba282~0xba28e — 2026-10-16 직접 떴다), 입력기
   * 0x677d4 도 같다. 자간 2 글꼴은 0x679d4 가 객체 +0x88 에 만드는 것(0x67a32~0x67a3a 의 0x9c9d0)인데, 0x679d4 는 로고 객체
   * (0x67989 가 만든다 — 같은 +0x94 상태 · +0x95 다음 상태 · +0x97 틱 칸)의 가상 함수라 그 글꼴은 로고 · 인증 창(웹 미이식) 몫이다.
   * R5 가 꼽은 다른 그리기 호출지도 모두 앱 전역 글꼴이다(r181 확정 — 0x9c069 를 담은 풀 9 곳 전수): 0x56cb6~0x56cde 는
   * `[[0x1400070]]+0x3c` 를 곧장, 0x5ae48 · 0x5ae7c 는 함수 0x5a990 이 0x5a9b4~0x5a9c0 에서 [sp+0x58] 에 둔 [0x1400070],
   * 0x5b6f4 · 0x5b728 은 0x5aefc 가 0x5af2a~0x5af34 에서 [sp+0x64] 에 둔 [0x1400070], 0x5e6be · 0x5e74a(0x5dcc0)는
   * 0x5dd3a~0x5dd42 의 [sp+0x40] 에서 각각 +0x3c 를 넘긴다. 글상자 클래스(표 0xd32c4 — 0x6f278 은 [this+4])도 만들기
   * 0x6ecb8 · 0x6ecd0 이 [this+4] = [[0x1400070]+0x3c] 로 채운다. 곧 자간 2 는 로고 객체 몫뿐이다.
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

/**
 * 글꼴 색은 565 로 찍힌다(글꼴 색 +0x54 는 16비트 565 값 — 기본 흰색 0xFFFF, `PixelText.css`) — `style.color` 를 `solidColorCss` 로 내린다.
 * ⚠️ 근사(남김 — 웹 DOM 한계): `className` · 부모에서 물려받은 색은 읽을 수 없어 그대로 둔다.
 */
function color565StyleOf(style: CSSProperties | undefined): CSSProperties {
  return typeof style?.color === 'string' ? { color: solidColorCss(style.color) } : {}
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
  'use memo'
  const gaps = FONT_SPACING[spacing]
  const layout = useMemo(
    () =>
      layoutPixelText(children, {
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
      style={{ width: layout.width * scale, height: layout.height * scale, ...style, ...color565StyleOf(style) }}
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
