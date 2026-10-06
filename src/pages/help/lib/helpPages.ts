import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'
import { GAME_VERSION, HELP_CHAPTER_LENGTHS } from '@/shared/config/helpSections'

/**
 * StrHOWTO 뷰어의 **쪽** — 원본은 쪽을 따로 들지 않고 `시작 = Σ 0xd0b18[0..장−1] + 쪽` 번째 StrHOWTO 를
 * 그때그때 읽는다 (`0x63776~0x63794` · 키 `0x638c8~0x6395a` → `0x635d0(뷰어, 번호)`).
 *
 * 쪽수도 표 `0xd0b18[장]` 그대로라 **빈 StrHOWTO[33] 도 한 쪽**이다 — 장 6 은 4쪽이다.
 * 그 쪽은 글 대신 게임물 등급표를 그린다(`0x592dc` → `0x54330`, `HELP_RATING_TABLE`).
 */

/** 장 `chapter` 의 쪽수 — 표 0xd0b18 그대로 (빈 쪽 포함) */
export function helpPageCountOf(chapter: number): number {
  return HELP_CHAPTER_LENGTHS[chapter] ?? 1
}

/** 장·쪽 → StrHOWTO 번호 (0x63776~0x63794 와 같은 누적) */
export function helpStringIndexOf(chapter: number, page: number): number {
  let start = 0
  for (let index = 0; index < chapter; index += 1) start += HELP_CHAPTER_LENGTHS[index] ?? 0
  return start + page
}

/**
 * 쪽 그리기 `0x58fd4` 끝의 장별 점프표 `0xd1ae0` — 장 6 만 `+0xfc == 1`(StrHOWTO[33]) 이면 글 `0x58750` 대신
 * 등급표 `0x54330` 을 그린다 (`0x592dc~0x592ec`).
 */
export function isHelpRatingPage(chapter: number, page: number): boolean {
  return chapter === 6 && page === 1
}

/** 쪽 글 원문 — StrHOWTO[32] 의 %s 는 버전이다 (`0x58796` sprintf) */
export function helpPageRawOf(chapter: number, page: number): string {
  const raw = ORIGINAL_HOWTO[helpStringIndexOf(chapter, page)] ?? ''
  return raw.replace('%s', GAME_VERSION)
}

/** 본문 글 칸 — `0x58fd4` 끝 `sp+0x58 = (x0 + 10, y0 + 0x2d, 0xa2, 0x97)` · 줄 수 11 (`0x58750` 의 0x6ef4c 인자) */
export const HELP_TEXT_BOX = {
  x: 34,
  y: 99,
  width: 162,
  height: 151,
  /** `0x6ef4c` 인자 sp+8 — 그릴 줄 수 */
  visibleLines: 11,
  /**
   * 줄 높이 — `0x6ef4c` 인자 sp+0x10 = −1 이라 글꼴 기본값(높이 11 + 줄간)이다.
   * ⚠️ 유력: 이 뷰어가 앱 전역 글꼴(줄간 3 → 14)을 쓴다고 본다(R5 5절). 글꼴 객체를 고르는 0x6ecd0(ctx, 1) 은 안 읽었다.
   */
  lineHeight: 14,
} as const

/** 글자 폭 — 한글 9 · 영문/공백 5, 자간 1 (앱 전역 글꼴, R5 5절 — 유력) */
const HANGUL_ADVANCE = 9
const ASCII_ADVANCE = 5
const LETTER_GAP = 1

export type HelpTextAlign = '왼' | '가운데' | '오른'

export interface HelpTextSegment {
  readonly text: string
  /** '#RRGGBB' 또는 기본(흰)색 null */
  readonly color: string | null
}

export interface HelpTextLine {
  readonly segments: readonly HelpTextSegment[]
  readonly align: HelpTextAlign
}

const isHangul = (character: string) => {
  const code = character.codePointAt(0) ?? 0
  return code >= 0x80
}

/**
 * 글을 원본 줄로 편다 — 글 배치 `0x6ef4c` 의 줄 나누기 그대로 (0x6efe0~0x6f23c):
 * - 글자 단위(한글 2바이트 · 영문 1바이트)로 폭을 재고, 줄 첫 글자가 아니면 자간을 더한다.
 *   `폭 − x − 글자폭 < 0` 이면 **그 글자 앞에서** 줄을 바꾼다 — 영문도 낱말이 아니라 글자 단위다.
 * - `!N` 줄바꿈 · `!L`/`!C`/`!R` 정렬(다음 토큰까지 이어진다) · `!cRRGGBB` 색. 그 밖의 `!` 는 글자 하나다.
 * - 끝의 `!N` 은 빈 줄을 하나 더 만들지 않는다(마지막 토큰에서 줄을 한 번만 닫는다). 빈 글은 0줄이다.
 */
export function wrapHelpText(raw: string, maxWidth: number = HELP_TEXT_BOX.width): readonly HelpTextLine[] {
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

  let index = 0
  while (index < raw.length) {
    const isLast = (unitLength: number) => index + unitLength >= raw.length
    if (raw[index] === '!' && index + 1 < raw.length) {
      const next = raw[index + 1]
      if (next === 'N') {
        flushLine()
        index += 2
        continue
      }
      if (next === 'L' || next === 'C' || next === 'R') {
        flushSegment()
        align = next === 'L' ? '왼' : next === 'C' ? '가운데' : '오른'
        index += 2
        if (isLast(0) && hasContent) flushLine()
        continue
      }
      if (next === 'c' && /^[0-9A-Fa-f]{6}$/.test(raw.slice(index + 2, index + 8))) {
        flushSegment()
        const code = raw.slice(index + 2, index + 8).toUpperCase()
        color = code === 'FFFFFF' ? null : `#${code}`
        index += 8
        if (isLast(0) && hasContent) flushLine()
        continue
      }
    }
    const character = raw[index]
    const advance = isHangul(character) ? HANGUL_ADVANCE : ASCII_ADVANCE
    const width = advance + (x > 0 ? LETTER_GAP : 0)
    if (maxWidth - x - width < 0 && x > 0) {
      // 넘치면 이 글자 앞에서 줄을 닫고 다음 줄 첫 글자로 다시 잰다 (0x6f216 `+0x44 = 0`)
      flushLine()
      continue
    }
    buffer += character
    x += width
    hasContent = true
    index += 1
    if (index >= raw.length) flushLine()
  }
  if (hasContent || buffer !== '') flushLine()
  return lines
}

/**
 * 스크롤 막대 — 줄 수를 받으면 `0x61c54(뷰어, 161, 11, 줄수)` 가 세우는 값 (`0x635d0` 끝, 0x63656).
 * ```
 * 61c78  막대 길이 +0x118 = 161 − 2 = 159 · 보이는 줄 +0x110 = 11 · 전체 +0x114 = 줄수 · 맨 윗줄 +0x108 = 0 · 손잡이 자리 +0x11c = 0
 * 61ca0  d = 159 / 11 = 14
 * 61cac  줄수 > 11 이면  남는 줄 e = 줄수 − 11 · 손잡이 길이 +0x120 = 159 − e×14 · 한 줄 걸음 +0x10c = 14
 * 61cbc    손잡이 길이 < 14 이면  손잡이 = 161 − 3e − 2 · 걸음 = 3
 * 61cd0  아니면  손잡이 = 159 · 걸음 = 0
 * ```
 */
export const HELP_SCROLL_BAR = {
  x: 203,
  y: 94,
  width: 7,
  /** 0x61c54 의 r1 = 161 */
  height: 161,
  trackLength: 159,
} as const

export interface HelpScrollMetrics {
  /** 손잡이 길이 (+0x120) */
  readonly knobLength: number
  /** 한 줄 내릴 때 손잡이가 움직이는 칸 (+0x10c) */
  readonly step: number
  /** 맨 윗줄의 최댓값 — 줄수 − 11 (0 아래로는 안 간다) */
  readonly maxTop: number
}

export function helpScrollMetricsOf(lineCount: number): HelpScrollMetrics {
  const visible = HELP_TEXT_BOX.visibleLines
  const track = HELP_SCROLL_BAR.trackLength
  if (lineCount <= visible) return { knobLength: track, step: 0, maxTop: 0 }
  const extra = lineCount - visible
  const unit = Math.trunc(track / visible)
  const knob = track - extra * unit
  if (knob >= unit) return { knobLength: knob, step: unit, maxTop: extra }
  return { knobLength: HELP_SCROLL_BAR.height - 3 * extra - 2, step: 3, maxTop: extra }
}

/**
 * 손잡이 자리 (+0x11c) — 줄을 내릴 때마다 걸음만큼 더하고 `막대 길이 − 10` 에서, 올릴 때 0 에서 멈춘다 (0x61ce4).
 * 줄 수가 막대에 맞으면(걸음 14 는 e ≤ 10, 걸음 3 은 e ≤ 49) 그 멈춤에 닿지 않아 `맨 윗줄 × 걸음` 과 같다.
 */
export function helpScrollKnobTopOf(lineCount: number, top: number): number {
  const { step } = helpScrollMetricsOf(lineCount)
  return Math.max(0, Math.min(top * step, HELP_SCROLL_BAR.trackLength - 10))
}

/**
 * 게임물 등급표 — 장 6 의 둘째 쪽(빈 StrHOWTO[33]) 자리에 `0x54330` 이 그린다.
 * ```
 * 54350  w = 150 · h = 90 · 줄 높이 = 90 / 6 = 15
 * 54384  x = (W − 150) / 2 − 5 = 40 · y = (y0 + 0x28) + 0x19 = 119
 * 543ac  바탕 RGB(87, 217, 132) (x, y, 150, 90) · 검정 테두리 넷 · 세로 칸막이 x + 0x3e
 * 544b4  i = 0..5:  이름 표 0xd1807[i] 를 (x + 2, y + 15i + 2) · 값 표 0xd18c7[i] 를 (x + 0x40, …) — 글 RGB(0, 35, 104)
 *                   가로줄 (x, y + 15(i + 1)) − (x + 150, …) 검정
 * ```
 */
export const HELP_RATING_TABLE = {
  x: 40,
  y: 119,
  width: 150,
  height: 90,
  rowHeight: 15,
  dividerX: 0x3e,
  valueX: 0x40,
  labelX: 2,
  textDy: 2,
  fill: 'rgb(87, 217, 132)',
  text: 'rgb(0, 35, 104)',
  rows: [
    ['제명', '2010프로야구'],
    ['이용등급', '전체이용가'],
    ['제작연월일', '2009.08.14'],
    ['상호', '(주)게임빌'],
    ['등급분류번호', 'MO-090814-004'],
    ['신고번호', '24108-2001-8'],
  ],
} as const
