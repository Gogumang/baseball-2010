import { FONT_SPACING, measurePixelTextWidth } from '@/shared/lib/font'
import { EVENT_DIALOGUE } from './dialogueBox'
import { markupAt } from './dialogueMarkup'
import type { DialogueAlign, DialogueMarkup } from './dialogueMarkup'

/** 0xd4f50 — 말하는 이 머리말 */
const SPEAKER_FORMAT = '[!c00CC00%s!cFFFFFF] : '

/** 0x8bab8 — 말하는 이 이름 머리말. 이름이 없으면(말하는 이 0 · 범위 밖) 빈 글 */
export function speakerPrefixOf(name: string | null): string {
  return name === null ? '' : SPEAKER_FORMAT.replace('%s', name)
}

/** %s 를 차례로 채운다 (`gameMarkup` 과 같은 규칙 — 모자라면 남긴다) */
export function substituteDialogue(raw: string, replacements: readonly string[]): string {
  let result = ''
  let cursor = 0
  for (const replacement of replacements) {
    const found = raw.indexOf('%s', cursor)
    if (found === -1) break
    result += raw.slice(cursor, found) + replacement
    cursor = found + 2
  }
  return result + raw.slice(cursor)
}

export interface DialogueGlyph {
  readonly character: string
  /** '#RRGGBB' 또는 기본(흰)색 null */
  readonly color: string | null
  /** 글에서 이 글자가 시작하는 바이트 */
  readonly start: number
}

export interface DialogueLine {
  readonly glyphs: readonly DialogueGlyph[]
  readonly align: DialogueAlign
}

export interface DialogueLayout {
  readonly lines: readonly DialogueLine[]
  /** 줄 k 의 첫 단위(글자 · 표시)가 시작하는 바이트 — 쪽 끝 계산에 쓴다 */
  readonly lineStarts: readonly number[]
  /** 글 전체 바이트 (+0xe6) */
  readonly totalBytes: number
}

/** 0x6ecd0 — 글상자는 앱 전역 글꼴(자간 +0x66 = 1) */
const LETTER_GAP = FONT_SPACING.app.letterGap

const byteSizeOf = (character: string) => ((character.codePointAt(0) ?? 0) >= 0x80 ? 2 : 1)

/** 줄을 쌓는 칸 — 지금 줄의 글자 · 글색 · 정렬 · x 와 글 전체 바이트 */
class DialogueLineBuilder {
  private readonly lines: DialogueLine[] = []
  private readonly lineStarts: number[] = []
  private glyphs: DialogueGlyph[] = []
  private color: string | null = null
  private align: DialogueAlign = '왼'
  private x = 0
  private byte = 0
  private lineStart = 0
  private hasContent = false

  constructor(private readonly maxWidth: number) {}

  /** 표시도 바이트를 먹는다 — `!N` 은 그 뒤에서 줄을 닫는다 */
  mark(markup: DialogueMarkup) {
    this.byte += markup.length
    if (markup.kind === '줄') this.flushLine(this.byte)
    else if (markup.kind === '정렬') this.align = markup.align
    else this.color = markup.color
  }

  /** 글자 하나를 놓는다 — 넘쳐서 줄만 닫았으면 거짓(같은 글자를 다음 줄에 다시 놓는다) */
  place(character: string): boolean {
    const width = measurePixelTextWidth(character) + (this.x > 0 ? LETTER_GAP : 0)
    if (this.maxWidth - this.x - width < 0 && this.x > 0) {
      // 넘치면 이 글자 앞에서 줄을 닫는다 — 다음 쪽 끝 바이트는 이 글자의 자리다 (0x6f216 `+0x44 = 0`)
      this.flushLine(this.byte)
      return false
    }
    this.glyphs.push({ character, color: this.color, start: this.byte })
    this.hasContent = true
    this.x += width
    this.byte += byteSizeOf(character)
    return true
  }

  finish(): DialogueLayout {
    if (this.hasContent || this.glyphs.length > 0) this.flushLine(this.byte)
    return { lines: this.lines, lineStarts: this.lineStarts, totalBytes: this.byte }
  }

  private flushLine(nextStart: number) {
    this.lines.push({ glyphs: this.glyphs, align: this.align })
    this.lineStarts.push(this.lineStart)
    this.glyphs = []
    this.x = 0
    this.hasContent = false
    this.lineStart = nextStart
  }
}

/**
 * 0x6ef4c 의 줄 나누기 · 바이트 셈 (0x6efe0~0x6f23c). 글자 단위로 폭을 재고 줄 첫 글자가 아니면 자간을 더해
 * `폭 − x − 글자폭 < 0` 이면 그 글자 앞에서 줄을 바꾼다. 끝의 `!N` 은 빈 줄을 하나 더 만들지 않는다.
 */
export function layoutDialogue(raw: string, maxWidth: number = EVENT_DIALOGUE.text.width): DialogueLayout {
  const builder = new DialogueLineBuilder(maxWidth)
  let index = 0
  while (index < raw.length) {
    const markup = markupAt(raw, index)
    if (markup !== null) {
      builder.mark(markup)
      index += markup.length
    } else if (builder.place(raw[index])) index += 1
  }
  return builder.finish()
}

/** 첫 줄부터 3줄 쪽의 끝 바이트 (0x6f24c — 다음 쪽 첫 줄의 시작, 없으면 글 끝) */
export function pageEndOf(layout: DialogueLayout, firstLine: number): number {
  const next = firstLine + EVENT_DIALOGUE.text.linesPerPage
  return next < layout.lineStarts.length ? layout.lineStarts[next] : layout.totalBytes
}

/** 지금 쪽에 보이는 줄 — 시작 바이트가 `shown` 안인 글자만 */
export function visibleDialogueLinesOf(layout: DialogueLayout, firstLine: number, shown: number): readonly DialogueLine[] {
  return layout.lines
    .slice(firstLine, firstLine + EVENT_DIALOGUE.text.linesPerPage)
    .map((line) => ({ ...line, glyphs: line.glyphs.filter((glyph) => glyph.start < shown) }))
}
