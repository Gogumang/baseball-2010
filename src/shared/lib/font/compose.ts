import {
  ASCII_ATLAS,
  DRAWABLE_SYLLABLES,
  FIRST_COMPAT_JAMO,
  HANGUL_ATLAS,
  JAMO_SLOTS,
  LAST_COMPAT_JAMO,
  TABLE_QUIRKS,
} from '@/shared/lib/font/atlas'

/**
 * 원본 비트맵 글꼴의 글자 합성 — 해독 문서 R5-font-particles.md 3·6 절을 그대로 옮긴 순수 함수다.
 *
 * 원본(0x9bb28)은 한 글자를 초성·중성·종성 조각 세 개를 OR 해서 만든다. 어느 "벌"의 조각을
 * 고를지는 옆 글자 모양(가로/세로/복합 모음, 받침 유무)과 글꼴 파일 끝에 들어 있는
 * 획 복잡도 표로 정해진다. 여기서는 그 고르기만 하고, 실제로 겹쳐 그리는 일은 PixelText 가 한다.
 *
 * 웹은 CP949 인코더가 없으므로 R5 6절대로 **유니코드 음절 분해로 바로 순번을 얻는다**.
 * (완성형 2350자 중 2347자가 원본 표 0xd602e 경유와 같고, 나머지 3자는 TABLE_QUIRKS 로 맞춘다.)
 */

/** 벌 고르기 표 0xd7290 의 모드 0 행 0..4 — [초성벌, 중성벌, 종성벌] */
const SET_ROWS: readonly (readonly [number, number, number])[] = [
  [6, 2, 1],
  [10, 5, 1],
  [6, 4, 3],
  [8, 3, 2],
  [5, 1, 0],
]

/** 0xd731d SHAPE[21] — 받침이 없을 때 중성 모양이 정하는 초성 벌 */
const SHAPE = [0, 1, 0, 1, 0, 1, 0, 1, 2, 4, 4, 4, 2, 3, 5, 5, 5, 3, 2, 4, 0]

/** 0xd7332 HZ[21] — 가로획이 있는 모음 ㅗ~ㅢ (중성 순번 8..19) */
const HAS_HORIZONTAL_STROKE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]

/** 0xd7347 CX[21] — 복합 모음 ㅘㅙㅚㅝㅞㅟㅢ */
const IS_COMPLEX_VOWEL = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]

const SYLLABLE_BASE = 0xac00
const JUNG_PER_CHO = 588
const JONG_PER_JUNG = 28

/** 0xA1A4 '·' 와 0xA1A5 '‥' 만 예외로 영문 글꼴의 '.' 과 ':' 로 바뀐다 (0x9c19c~0x9c1b2) */
const ASCII_SUBSTITUTES: Readonly<Record<string, string>> = { '·': '.', '‥': ':' }

const ASCII_LAST = 0x7e

export interface GlyphPiece {
  readonly atlas: 'hangul' | 'ascii'
  /** 아틀라스 격자 칸 */
  readonly column: number
  readonly row: number
  /** 글자 칸 안에서 오른쪽으로 미는 픽셀 */
  readonly shiftX: number
}

export type Glyph =
  /** 그릴 조각이 있는 글자 */
  | { readonly kind: 'draw'; readonly pieces: readonly GlyphPiece[]; readonly advance: number }
  /** 공백·제어 — 안 그리지만 영문 폭만큼 전진한다 */
  | { readonly kind: 'blank'; readonly advance: number }
  /** 줄바꿈 */
  | { readonly kind: 'newline' }
  /** 2350자 밖 글자·전각 숫자·대부분의 기호 — 안 그리고 전진도 하지 않는다 */
  | { readonly kind: 'skip' }

/** 초성·중성·종성 조각 순번. 없는 자리는 −1 이다 (종성 없음 등). */
export interface JamoIndices {
  readonly cho: number
  readonly jung: number
  readonly jong: number
}

/** 세 자리가 고른 벌 번호 */
export interface JamoSets {
  readonly choSet: number
  readonly jungSet: number
  readonly jongSet: number
}

/**
 * 글자 하나를 초성·중성·종성 조각 순번으로 나눈다. 원본이 못 그리는 글자는 null.
 *
 * - 완성형 2350자: `s = cp − 0xAC00` 에서 바로 얻는다 (R5 6절).
 * - 호환 자모 51자: 자음은 초성 자리, 모음은 중성 자리, 겹자음은 종성 자리에 홀로 놓인다.
 */
export function decomposeSyllable(character: string): JamoIndices | null {
  const code = character.codePointAt(0) ?? -1
  if (code >= FIRST_COMPAT_JAMO && code <= LAST_COMPAT_JAMO) {
    const slot = JAMO_SLOTS[code - FIRST_COMPAT_JAMO]
    return { cho: slot[0], jung: slot[1], jong: slot[2] }
  }
  // 그릴 수 있는지는 원래 글자로 따진다. 오타가 가리키는 괨·닖·쎙 은 2350자 밖이라
  // 순서를 뒤집으면 세 글자가 통째로 사라진다.
  if (!DRAWABLE_SYLLABLES.has(character)) return null
  const drawn = TABLE_QUIRKS[character] ?? character
  const offset = (drawn.codePointAt(0) ?? SYLLABLE_BASE) - SYLLABLE_BASE
  return {
    cho: Math.trunc(offset / JUNG_PER_CHO),
    jung: Math.trunc((offset % JUNG_PER_CHO) / JONG_PER_JUNG),
    jong: (offset % JONG_PER_JUNG) - 1,
  }
}

/**
 * 세 자리가 각각 몇 번째 벌의 조각을 쓸지 고른다 (0x9bb28, 모드 0 · 머리글 없는 형식).
 *
 * 가로 모음 + 받침이면 초성·종성의 획 복잡도를 더해 표 0xd7290 의 행을 고르고,
 * 받침이 없으면 중성 모양(SHAPE)이 초성 벌을 정하며, 세로 모음 + 받침이면 마지막 행을 쓴다.
 */
export function chooseSets({ cho, jung, jong }: JamoIndices): JamoSets {
  // 자음·겹자음이 홀로 있을 때 원본은 HZ/SHAPE 를 첨자 −1 로 읽는다. 그 자리(표 바로 앞)는
  // 둘 다 0 이라 아래처럼 0 으로 취급한 것과 결과가 같다. **원본을 그대로 옮긴 것이지 근사가 아니다.**
  const vowel = jung < 0 && jong < 0 ? 0 : jung
  const horizontal = vowel >= 0 ? HAS_HORIZONTAL_STROKE[vowel] === 1 : false

  if (horizontal && jong >= 0) {
    const choStroke = HANGUL_ATLAS.choStroke[Math.max(cho, 0)]
    const jongStroke = HANGUL_ATLAS.jongStroke[jong]
    const rowIndex =
      choStroke + jongStroke > 4 ? 0
        : choStroke === 1 && jongStroke === 3 ? 1
          : choStroke === 3 && jongStroke === 1 ? 2
            : 3
    const row = SET_ROWS[rowIndex]
    return {
      choSet: row[0] + (IS_COMPLEX_VOWEL[vowel] === 1 ? 1 : 0),
      jungSet: row[1],
      // 모음 홀로는 여기 오지 않는다 (jong >= 0)
      jongSet: row[2],
    }
  }

  if (jong < 0) {
    const shape = vowel >= 0 ? SHAPE[vowel] : 0
    return {
      choSet: shape > 0 ? shape - 1 : shape, // 머리글 없는 형식에서만 1 뺀다
      // 모음이 홀로 있으면 중성 전용 벌 6 을 쓴다 (0x9bcb8)
      jungSet: cho < 0 ? 6 : 0,
      jongSet: 0,
    }
  }

  const row = SET_ROWS[4]
  return { choSet: row[0], jungSet: row[1], jongSet: 0 }
}

/**
 * 조각 세 개의 아틀라스 칸과 미는 양.
 *
 * 원본(0x9baf8)의 미는 동작은 13바이트 조각 **전체를 한 비트열로** 오른쪽으로 미는 것이라
 * 9픽셀 행 경계를 넘어 감길 수 있다. 그런데 실제로 닿는 조합(초성 벌 0 을 2픽셀,
 * 종성 아무 벌이나 1픽셀)에서는 밀려 나가는 비트가 전부 0 이라 그냥 픽셀을 오른쪽으로
 * 옮긴 것과 비트 단위로 같다 — tools/extract_font.py 의 verify_pixel_shift 가 매번 확인한다.
 */
export function composePieces(indices: JamoIndices): readonly GlyphPiece[] {
  const { cho, jung, jong } = indices
  const { choSet, jungSet, jongSet } = chooseSets(indices)
  const pieces: GlyphPiece[] = []

  if (cho >= 0) {
    pieces.push({
      atlas: 'hangul',
      column: cho,
      row: HANGUL_ATLAS.choRow + choSet,
      // 자음이 홀로 있으면 2픽셀 오른쪽으로 (0x9bd2e)
      shiftX: jung < 0 && jong < 0 ? 2 : 0,
    })
  }
  if (jung >= 0) {
    pieces.push({ atlas: 'hangul', column: jung, row: HANGUL_ATLAS.jungRow + jungSet, shiftX: 0 })
  }
  if (jong >= 0) {
    pieces.push({
      atlas: 'hangul',
      column: jong,
      row: HANGUL_ATLAS.jongRow + jongSet,
      // ㅐㅒㅔㅖㅙㅞ 처럼 세로획이 둘인 모음 아래에서는 받침을 1픽셀 민다
      shiftX: jung >= 0 ? HANGUL_ATLAS.jungStroke[jung] : 0,
    })
  }
  return pieces
}

/**
 * 글자 하나가 무엇으로 그려지고 얼마나 전진하는지. 자간은 붙이지 않는다 (배치 쪽에서 더한다).
 *
 * 원본 0x9c068 의 전진 규칙 그대로:
 * 0x21~0x7E 는 영문 조각, 공백·제어는 그림 없이 영문 폭만큼 전진, 한글은 합성해서 9px,
 * 2350자 밖 글자·기호는 **폭이 0 이라 안 그리고 전진도 안 한다**.
 */
export function glyphOf(character: string): Glyph {
  if (character === '\n') return { kind: 'newline' }

  const substituted = ASCII_SUBSTITUTES[character] ?? character
  const code = substituted.codePointAt(0) ?? -1
  if (code < 0x80) {
    if (code >= ASCII_ATLAS.first && code <= ASCII_LAST) {
      const index = code - ASCII_ATLAS.first
      return {
        kind: 'draw',
        advance: ASCII_ATLAS.glyphWidth,
        pieces: [{
          atlas: 'ascii',
          column: index % ASCII_ATLAS.columns,
          row: Math.trunc(index / ASCII_ATLAS.columns),
          shiftX: 0,
        }],
      }
    }
    // 0x7F 을 포함한 제어문자와 공백. 그림은 없어도 전진은 한다.
    return { kind: 'blank', advance: ASCII_ATLAS.glyphWidth }
  }

  const indices = decomposeSyllable(substituted)
  if (indices === null) return { kind: 'skip' }
  return { kind: 'draw', advance: HANGUL_ATLAS.glyphWidth, pieces: composePieces(indices) }
}
