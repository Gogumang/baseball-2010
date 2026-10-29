import type { CSSProperties } from 'react'
import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'
import type { PlacedPiece } from '@/shared/lib/font/layout'

const ATLAS_URL = { hangul: HANGUL_ATLAS.atlas, ascii: ASCII_ATLAS.atlas } as const
const ATLAS_SIZE = {
  hangul: [HANGUL_ATLAS.atlasWidth, HANGUL_ATLAS.atlasHeight],
  ascii: [ASCII_ATLAS.atlasWidth, ASCII_ATLAS.atlasHeight],
} as const

/**
 * 조각 한 칸을 아틀라스에서 떠 오는 마스크 스타일.
 *
 * 시험 DOM 은 mask-* 를 아예 버려서 DOM 으로는 확인할 수 없다. 그래서 따로 빼 두고 값만 테스트한다.
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
