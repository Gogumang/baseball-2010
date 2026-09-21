/**
 * 원본 비트맵 글꼴(synGak9_11.ft2 · synGulimAsc5_11.ft2) 조합·배치.
 *
 * 그림 자산은 tools/extract_font.py 가 만든다:
 *   python3 tools/extract_font.py
 *
 * 화면에 붙이는 일은 shared/ui/PixelText 가 한다.
 */
export {
  ASCII_ATLAS,
  DRAWABLE_SYLLABLES,
  HANGUL_ATLAS,
  JAMO_SLOTS,
  TABLE_QUIRKS,
} from '@/shared/lib/font/atlas'
export { chooseSets, composePieces, decomposeSyllable, glyphOf } from '@/shared/lib/font/compose'
export type { Glyph, GlyphPiece, JamoIndices, JamoSets } from '@/shared/lib/font/compose'
export {
  ASCII_WIDTH,
  FONT_SPACING,
  HANGUL_WIDTH,
  LINE_HEIGHT,
  layoutPixelText,
  measurePixelTextWidth,
} from '@/shared/lib/font/layout'
export type { PixelTextLayout, PixelTextOptions, PlacedPiece } from '@/shared/lib/font/layout'
