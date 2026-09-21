import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'
import { glyphOf } from '@/shared/lib/font/compose'

/**
 * 원본 글자 그리기 0x9c068 의 배치 규칙 (R5 5절).
 *
 * 한글은 9 + 자간, 영문·공백은 5 + 자간만큼 전진하고, 줄 높이는 11 + 줄간이다.
 * 줄바꿈은 한글이면 글자마다, 영문이면 **낱말 단위**로 따진다.
 */

/** 글꼴 객체 +0x60 — 한글 조각 폭 */
export const HANGUL_WIDTH = HANGUL_ATLAS.glyphWidth
/** 글꼴 객체 +0x62 — 영문 조각 폭 */
export const ASCII_WIDTH = ASCII_ATLAS.glyphWidth
/** 글꼴 객체 +0x6c — max(한글 높이, 영문 높이) = 11 */
export const LINE_HEIGHT = Math.max(HANGUL_ATLAS.glyphHeight, ASCII_ATLAS.glyphHeight)

/**
 * 원본에 글꼴 객체가 둘 있고 자간·줄간이 서로 다르다 (R5 5절).
 *
 * ⚠️ **어느 화면이 어느 쪽을 쓰는지는 해독 문서도 미확인이다** (R5 5절 "남은 것").
 * 문서의 유력한 추측이 "게임 전역 글꼴 = 앱+0x3c = 자간 1" 이라 app 을 기본값으로 삼았다 —
 * 화면별로 어느 쪽인지 가리지 못했으니 기본값 고르기는 **근사다**. 화면마다 prop 으로 바꿀 수 있다.
 */
export const FONT_SPACING = {
  /** 앱 초기화 0x2ed8 이 만드는 앱+0x3c 글꼴 (0x6b330): 한글 10px · 영문 6px · 줄 14px */
  app: { letterGap: 1, lineGap: 3 },
  /** 글상자 클래스가 쓰는 0x679d4 객체: 기본값 그대로 — 한글 11px · 영문 7px · 줄 13px */
  textBox: { letterGap: 2, lineGap: 2 },
} as const

export interface PixelTextOptions {
  /** 글자 사이 여백. 1(앱 전역 글꼴) 또는 2(글상자 글꼴) */
  readonly letterGap?: number
  /** 줄 사이 여백. 3(앱 전역 글꼴) 또는 2(글상자 글꼴) */
  readonly lineGap?: number
  /** 0 보다 크면 이 폭에서 줄을 접는다 (원본 maxW) */
  readonly maxWidth?: number
  /**
   * 줄 첫머리 공백을 전진 없이 버린다 (원본 0x9c068 의 [sp+0x50] 플래그).
   * 호출지마다 켜고 끄는데 어디가 켜는지는 해독 문서에 없다 — 기본값 false 는 **근사다**.
   */
  readonly skipLeadingSpace?: boolean
}

/** 아틀라스에서 떠서 화면 어디에 찍을지까지 정해진 조각 하나 */
export interface PlacedPiece {
  readonly atlas: 'hangul' | 'ascii'
  readonly column: number
  readonly row: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PixelTextLayout {
  readonly pieces: readonly PlacedPiece[]
  /** 가장 긴 줄의 폭 (마지막 자간은 빼고) */
  readonly width: number
  readonly height: number
  readonly lineCount: number
}

const ASCII_FIRST = 0x21
const ASCII_LAST = 0x7e

function isWordCharacter(character: string | undefined): boolean {
  if (character === undefined) return false
  const code = character.codePointAt(0) ?? 0
  return code >= ASCII_FIRST && code <= ASCII_LAST
}

/**
 * 글을 조각 목록으로 편다.
 *
 * 줄바꿈 규칙(0x9c2f8~0x9c328):
 * - 한글: `x + 9 > maxWidth` 이면 그 글자부터 다음 줄
 * - 영문: 낱말(0x21~0x7E 연속 n자)을 통째로 재서 `x + n*(5+자간) − 자간 > maxWidth` 이고
 *   줄 첫머리가 아니면 낱말 앞에서 줄을 바꾼다. 한 낱말이 한 줄보다 길면 원본대로 넘친다.
 */
export function layoutPixelText(text: string, options: PixelTextOptions = {}): PixelTextLayout {
  const letterGap = options.letterGap ?? FONT_SPACING.app.letterGap
  const lineGap = options.lineGap ?? FONT_SPACING.app.lineGap
  const maxWidth = options.maxWidth ?? 0
  const skipLeadingSpace = options.skipLeadingSpace ?? false

  const characters = [...text]
  const pieces: PlacedPiece[] = []
  let x = 0
  let y = 0
  let widest = 0
  let lineCount = 1

  const breakLine = () => {
    widest = Math.max(widest, x - letterGap)
    x = 0
    y += LINE_HEIGHT + lineGap
    lineCount += 1
  }

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]
    const glyph = glyphOf(character)

    if (glyph.kind === 'newline') {
      breakLine()
      continue
    }
    if (glyph.kind === 'skip') continue

    if (glyph.kind === 'blank') {
      // 줄 첫머리 공백은 플래그가 켜져 있으면 없던 것처럼 버린다
      if (x === 0 && skipLeadingSpace) continue
      x += glyph.advance + letterGap
      continue
    }

    if (maxWidth > 0) {
      if (isWordCharacter(character)) {
        // 낱말의 첫 글자에서만 낱말 전체를 재 본다
        if (!isWordCharacter(characters[index - 1])) {
          let length = 0
          while (isWordCharacter(characters[index + length])) length += 1
          const wordWidth = length * (ASCII_WIDTH + letterGap) - letterGap
          if (x > 0 && x + wordWidth > maxWidth) breakLine()
        }
      } else if (x + HANGUL_WIDTH > maxWidth && x > 0) {
        breakLine()
      }
    }

    for (const piece of glyph.pieces) {
      pieces.push({
        atlas: piece.atlas,
        column: piece.column,
        row: piece.row,
        x: x + piece.shiftX,
        y,
        width: piece.atlas === 'hangul' ? HANGUL_ATLAS.glyphWidth : ASCII_ATLAS.glyphWidth,
        height: piece.atlas === 'hangul' ? HANGUL_ATLAS.glyphHeight : ASCII_ATLAS.glyphHeight,
      })
    }
    x += glyph.advance + letterGap
  }

  widest = Math.max(widest, x - letterGap)
  return {
    pieces,
    width: Math.max(widest, 0),
    height: y + LINE_HEIGHT,
    lineCount,
  }
}

/**
 * 원본 폭 재기 0x9c52c. 가운데·오른쪽 맞춤이 이걸로 x 를 당긴다.
 *
 * ⚠️ **원본 버그를 그대로 옮긴다**: 못 그리는 글자(2350자 밖·기호)를 그리기 쪽은 0px 로 넘기는데
 * 폭 재기는 자간만큼 더한다(0x9c63a~0x9c654). 그래서 그런 글자가 든 줄은 잰 폭이 실제보다
 * 글자당 자간만큼 넓다. 원본 화면이 그만큼 어긋나게 맞추므로 고치지 않는다.
 */
export function measurePixelTextWidth(text: string, options: PixelTextOptions = {}): number {
  const letterGap = options.letterGap ?? FONT_SPACING.app.letterGap
  let width = 0
  for (const character of [...text]) {
    const glyph = glyphOf(character)
    if (glyph.kind === 'newline') break
    width += glyph.kind === 'skip' ? letterGap : glyph.advance + letterGap
  }
  return Math.max(width - letterGap, 0)
}
