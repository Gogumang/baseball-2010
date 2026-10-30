/**
 * 원본이 쓰는 텍스트 마크업을 화면에 그릴 수 있는 구조로 바꾼다.
 *
 *   !N          줄바꿈
 *   !C          가운데 정렬 — 다음 !L 까지 이어진다
 *   !L          왼쪽 정렬 — 다음 !C 까지 이어진다
 *               (게임문의 StrHOWTO[32] 가 !C 뒤 여러 줄을 가운데로 두고 끝에서 !L 로 바꾼다)
 *   !cRRGGBB    이후 글자 색. 다음 !c가 나올 때까지 유지된다.
 *   %s          선수 또는 팀 이름으로 치환
 *
 * 원본 문자열을 그대로 두고 렌더링 시점에 해석한다 — 데이터에 색을 박아넣으면
 * 나중에 테마를 바꿀 수 없다.
 */

export interface MarkupSegment {
  readonly text: string
  /** '#RRGGBB' 또는 기본색을 뜻하는 null */
  readonly color: string | null
}

export interface MarkupLine {
  readonly segments: readonly MarkupSegment[]
  readonly isCentered: boolean
}

const LINE_BREAK = '!N'
const CENTER = '!C'
const LEFT = '!L'
const COLOR_PREFIX = '!c'
const COLOR_CODE_LENGTH = 6
const NAME_PLACEHOLDER = '%s'

/** 원본이 '기본색으로 되돌리기'에 쓰는 흰색 코드 */
const DEFAULT_COLOR_CODE = 'FFFFFF'

/** 글 사이의 제어 표시 — 줄바꿈 · 정렬 · 색. `length` 는 표시가 차지한 글자 수 */
type MarkupToken =
  | { readonly kind: 'break'; readonly length: number }
  | { readonly kind: 'align'; readonly isCentered: boolean; readonly length: number }
  | { readonly kind: 'color'; readonly color: string | null; readonly length: number }

/** `index` 자리에서 시작하는 제어 표시 — 없으면(보통 글자) null. 꼴이 틀린 `!c` 는 보통 글자다 */
function markupTokenAt(text: string, index: number): MarkupToken | null {
  const rest = text.slice(index)
  if (rest.startsWith(LINE_BREAK)) return { kind: 'break', length: LINE_BREAK.length }
  if (rest.startsWith(CENTER)) return { kind: 'align', isCentered: true, length: CENTER.length }
  if (rest.startsWith(LEFT)) return { kind: 'align', isCentered: false, length: LEFT.length }
  if (!rest.startsWith(COLOR_PREFIX)) return null
  const code = text.slice(index + COLOR_PREFIX.length, index + COLOR_PREFIX.length + COLOR_CODE_LENGTH)
  if (!isColorCode(code)) return null
  const color = code.toUpperCase() === DEFAULT_COLOR_CODE ? null : `#${code}`
  return { kind: 'color', color, length: COLOR_PREFIX.length + COLOR_CODE_LENGTH }
}

export function parseGameMarkup(raw: string, replacements: readonly string[] = []): readonly MarkupLine[] {
  const substituted = substituteNames(raw, replacements)
  const lines: MarkupLine[] = []

  let segments: MarkupSegment[] = []
  let buffer = ''
  let color: string | null = null
  let isCentered = false

  const flushSegment = () => {
    if (buffer !== '') {
      segments.push({ text: buffer, color })
      buffer = ''
    }
  }
  const flushLine = () => {
    flushSegment()
    lines.push({ segments, isCentered })
    segments = []
  }

  let index = 0
  while (index < substituted.length) {
    const token = markupTokenAt(substituted, index)
    if (token === null) {
      buffer += substituted[index]
      index += 1
      continue
    }
    index += token.length
    if (token.kind === 'break') flushLine()
    else if (token.kind === 'align') isCentered = token.isCentered
    else {
      flushSegment()
      color = token.color
    }
  }
  flushLine()

  return lines
}

/** 마크업을 전부 걷어낸 순수 텍스트. 로그·테스트·검색에 쓴다. */
export function stripGameMarkup(raw: string, replacements: readonly string[] = []): string {
  return parseGameMarkup(raw, replacements)
    .map((line) => line.segments.map((segment) => segment.text).join(''))
    .join('\n')
}

/** %s를 순서대로 치환한다. 채울 값이 모자라면 남은 %s는 그대로 둔다. */
function substituteNames(raw: string, replacements: readonly string[]): string {
  let result = ''
  let cursor = 0
  let used = 0

  for (;;) {
    const found = raw.indexOf(NAME_PLACEHOLDER, cursor)
    if (found === -1 || used >= replacements.length) break
    result += raw.slice(cursor, found) + replacements[used]
    cursor = found + NAME_PLACEHOLDER.length
    used += 1
  }
  return result + raw.slice(cursor)
}

function isColorCode(code: string): boolean {
  return code.length === COLOR_CODE_LENGTH && /^[0-9A-Fa-f]{6}$/.test(code)
}
