import { FONT_SPACING, measurePixelTextWidth } from '@/shared/lib/font'

/**
 * 글 배치 `0x6ef4c` 줄 나누기(0x6efe0~0x6f23c)의 부품 — `!` 명령 읽기와 줄 쓰개. 줄 나누기 자체는 `helpPages.wrapHelpText`.
 */

/** 자간 — 0x6ecd0 이 고른 앱 전역 글꼴의 +0x66 = 1 */
const LETTER_GAP = FONT_SPACING.app.letterGap

export type HelpTextAlign = '왼' | '가운데' | '오른'

interface HelpTextSegment {
  readonly text: string
  /** '#RRGGBB' 또는 기본(흰)색 null */
  readonly color: string | null
}

export interface HelpTextLine {
  readonly segments: readonly HelpTextSegment[]
  readonly align: HelpTextAlign
}

/** `!N` 줄바꿈 · `!L`/`!C`/`!R` 정렬 · `!cRRGGBB` 색 — `length` 는 명령이 먹는 글자 수 */
type HelpCommand =
  | { readonly kind: 'newline'; readonly length: number }
  | { readonly kind: 'align'; readonly align: HelpTextAlign; readonly length: number }
  | { readonly kind: 'color'; readonly color: string | null; readonly length: number }

const ALIGN_OF_LETTER: ReadonlyMap<string, HelpTextAlign> = new Map([
  ['L', '왼'],
  ['C', '가운데'],
  ['R', '오른'],
])
const HEX_COLOR = /^[0-9A-Fa-f]{6}$/
/** 기본(흰)색 — 색 null 로 둔다 */
const WHITE = 'FFFFFF'

/** `index` 자리의 `!` 명령 — 명령이 아니면(그 밖의 `!` 는 글자 하나) null */
export function helpCommandAt(raw: string, index: number): HelpCommand | null {
  if (raw[index] !== '!' || index + 1 >= raw.length) return null
  const next = raw[index + 1]
  if (next === 'N') return { kind: 'newline', length: 2 }
  const align = ALIGN_OF_LETTER.get(next)
  if (align !== undefined) return { kind: 'align', align, length: 2 }
  const code = raw.slice(index + 2, index + 8)
  if (next !== 'c' || !HEX_COLOR.test(code)) return null
  const upper = code.toUpperCase()
  return { kind: 'color', color: upper === WHITE ? null : `#${upper}`, length: 8 }
}

/** 줄 쓰개 — 지금 줄의 조각 · 색 · 정렬 · 폭(x)을 들고 줄을 닫아 `lines` 에 쌓는다 */
export function createHelpLineWriter() {
  const lines: HelpTextLine[] = []
  let segments: HelpTextSegment[] = []
  let buffer = ''
  let color: string | null = null
  let align: HelpTextAlign = '왼'
  let x = 0
  let hasContent = false

  const flushSegment = () => {
    if (buffer === '') return
    segments.push({ text: buffer, color })
    buffer = ''
  }
  const flushLine = () => {
    flushSegment()
    lines.push({ segments, align })
    segments = []
    x = 0
    hasContent = false
  }
  return {
    lines,
    flushLine,
    /** 명령 하나 — 정렬 · 색은 다음 토큰까지 이어진다. 글 끝에 닿았고 줄에 글자가 있으면 줄을 닫는다 */
    apply(command: HelpCommand, isAtEnd: boolean) {
      if (command.kind === 'newline') {
        flushLine()
        return
      }
      flushSegment()
      if (command.kind === 'align') align = command.align
      else color = command.color
      if (isAtEnd && hasContent) flushLine()
    },
    /** 한 글자 폭 0x6f2e4 → 0x9c52c — 한글 9 · 영문/공백 5 · 못 그리는 글자 0. 줄 첫 글자가 아니면 자간을 더한다 */
    widthOf(character: string): number {
      return measurePixelTextWidth(character) + (x > 0 ? LETTER_GAP : 0)
    },
    /** `폭 − x − 글자폭 < 0` 이면 넘친다 — 줄 첫 글자는 넘쳐도 싣는다 */
    overflows(width: number, maxWidth: number): boolean {
      return maxWidth - x - width < 0 && x > 0
    },
    put(character: string, width: number) {
      buffer += character
      x += width
      hasContent = true
    },
    /** 글 끝 — 남은 줄을 닫는다(끝의 `!N` 은 빈 줄을 더 만들지 않는다) */
    finish() {
      if (hasContent || buffer !== '') flushLine()
    },
  }
}
