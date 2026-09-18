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
    const rest = substituted.slice(index)

    if (rest.startsWith(LINE_BREAK)) {
      flushLine()
      index += LINE_BREAK.length
      continue
    }
    if (rest.startsWith(CENTER)) {
      isCentered = true
      index += CENTER.length
      continue
    }
    if (rest.startsWith(LEFT)) {
      isCentered = false
      index += LEFT.length
      continue
    }
    if (rest.startsWith(COLOR_PREFIX)) {
      const code = substituted.slice(index + COLOR_PREFIX.length, index + COLOR_PREFIX.length + COLOR_CODE_LENGTH)
      if (isColorCode(code)) {
        flushSegment()
        color = code.toUpperCase() === DEFAULT_COLOR_CODE ? null : `#${code}`
        index += COLOR_PREFIX.length + COLOR_CODE_LENGTH
        continue
      }
    }
    buffer += substituted[index]
    index += 1
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
