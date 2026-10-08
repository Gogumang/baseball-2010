/**
 * **이벤트 재생기 say 명령의 대사 상자** — 공용 대사 창 0x7fbc4 / 상자 0x7fad0 (직접 떴다 · R14 3-4 와 같은 창 클래스 0x7b7b8).
 *
 * ```
 * 실행  0x8cf64 → 0xd4ec0[0] = 0x8d1f2 (say):
 *         [mgr+0x2c0] == 0 이면 0x7f7cc(창) — 창 높이 +0xea = 0 (이벤트의 첫 say 에서만 상자가 아래에서 올라온다) · [mgr+0x2c0] = 1
 *         0x8bab8(mgr, 명령) — 글을 짓는다 · 0x7f7d5(창) — 글자 수 +0xe6 = 글 길이(바이트), +0xeb 첫 줄 = 0, +0xe8 = 0, 단계 +0xec = 0
 * 글    0x8bab8: 말하는 이 [명령+0x20] ≠ 0 이면 머리말 sprintf(0xd4f50 "[!c00CC00%s!cFFFFFF] : ", 이름)
 *         1 = 선수 이름 0x7ff01 (시즌모드 0x7b999 면 빈 이름 — 머리말 없이 빈 글) · 2~24 = 글 표 [mgr+0x300] 의 [말하는 이 + 0x5b]
 *         (2 → 93 "감독", `SPEAKER_NAMES`) · 그 밖 없음
 *         내장 표(mgr+0xa)면 [이벤트+0xb] 일 때 기록 줄(이벤트 +0x2cc) 을 잇고, 글 [명령+0x1e] — 10000 = 전역 버퍼 0x1552af4 ·
 *         50000 = 없음 · 그 밖 StrUSER_EVT[번호]
 * 그림  114 0x8b5ac → 0x7fbc4(창, 고른 칸 [mgr+0xb9], 효과 칠, 1) → 0x7fad0(창, …, 장식 1):
 *         높이 h = min(h + 15, 55)                                         ; 0x7fae2 — 틱마다 15 씩 올라온다
 *         0x7cfc8(창, (0, H − h − 12, W, 12), W − 67)                      ; 윗 띠 — `ManagementBoard` 의 이름 띠와 같은 그림
 *         0xb9f74((0, H − h, W, h), 0xB4000000)                            ; 본체 검정 알파 0xB4
 *         장식이면 mode_ui 프레임 21 을 (W, H − h) 에 0xba19d               ; [[창+0x138]+0xc]+8 의 +0x54 (프레임 10 · 11 이 +0x28 · +0x2c 인 것과 같은 표)
 *         h == 55 일 때만 글을 그린다 (0x7fba6)
 *       글 0x6ef4c(글꼴, 글, x 5, y H − h + 5, 폭 W − 20, 흰색, 바이트 수, 줄 수 3, 첫 줄 +0xeb, 줄 높이 14)
 *         바이트 수 −1 로 한 번 재어 그 쪽(3줄)의 끝 바이트 [sp+0x48] 를 얻고 (0x6f24c — 다음 쪽 첫 글자의 자리),
 *         단계 0 → 1 · 2 → 1 이면서 +0xe8 = 쪽 끝 · 1 이면 +0xe8 = min(+0xe8 + 3, 쪽 끝) — **틱마다 3 바이트**
 *         +0xe8 ≥ 글 길이 → 단계 4 · == 쪽 끝 → 단계 3. 그린 바이트 수는 +0xe8 — 글자는 시작 바이트가 그 안이면 통째로 나온다
 * 키    114 0x13b88 → 0x8b804 (확인 −5 · '5'): 단계 1 → 2 (그 쪽을 다 보인다) · 3 → 0x7f7f4 (첫 줄 += 3, 단계 1) · 4 → 다음 명령
 * ```
 * 바이트는 원본 글 CP949 다 — 한글 2 · 영문 1, `!N` · `!C` · `!L` · `!R` 2, `!cRRGGBB` 8 (안 보이는 표시도 찍기 시간을 먹는다).
 * 줄 나누기는 0x6ef4c 그대로(`wrapHelpText` 와 같은 규칙) — 글자 폭 한글 9 · 영문 5 · 자간 1 은 **유력**(0x6ecd0 미해독, I 문서).
 * ⚠️ 장식 프레임 21 의 그림과 원점(−48, −8)은 mode_ui origins 그대로다.
 */

export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320

export const EVENT_DIALOGUE = {
  /** 0x7fae2 — 다 올라온 높이 */
  boxHeight: 0x37,
  /** 0x7fae2 — 틱마다 오르는 높이 */
  slideStep: 0xf,
  /** 0x7fb36 — 윗 띠 높이 */
  bandHeight: 12,
  /** 0x7fb32 — 띠가 꺾이는 x = W − 67 */
  bandSplit: SCREEN_WIDTH - 0x43,
  /** 0x7fb56 — 본체 검정 알파 */
  boxAlpha: 0xb4 / 0xff,
  /** 0x7fb96 — 장식 mode_ui 프레임 (W, 본체 위) */
  ornamentFrame: 21,
  text: {
    x: 5,
    /** 본체 위에서 */
    top: 5,
    width: SCREEN_WIDTH - 0x14,
    lineHeight: 0xe,
    linesPerPage: 3,
  },
  /** 0x7fcc4 — 틱마다 드러나는 바이트 */
  bytesPerTick: 3,
} as const

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

export type DialogueAlign = '왼' | '가운데' | '오른'

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

const HANGUL_ADVANCE = 9
const ASCII_ADVANCE = 5
const LETTER_GAP = 1

const byteSizeOf = (character: string) => ((character.codePointAt(0) ?? 0) >= 0x80 ? 2 : 1)

/**
 * 0x6ef4c 의 줄 나누기 · 바이트 셈 (0x6efe0~0x6f23c). 글자 단위로 폭을 재고 줄 첫 글자가 아니면 자간을 더해
 * `폭 − x − 글자폭 < 0` 이면 그 글자 앞에서 줄을 바꾼다. 끝의 `!N` 은 빈 줄을 하나 더 만들지 않는다.
 */
export function layoutDialogue(raw: string, maxWidth: number = EVENT_DIALOGUE.text.width): DialogueLayout {
  const lines: DialogueLine[] = []
  const lineStarts: number[] = []
  let glyphs: DialogueGlyph[] = []
  let color: string | null = null
  let align: DialogueAlign = '왼'
  let x = 0
  let byte = 0
  let lineStart = 0
  let hasContent = false

  const flushLine = (nextStart: number) => {
    lines.push({ glyphs, align })
    lineStarts.push(lineStart)
    glyphs = []
    x = 0
    hasContent = false
    lineStart = nextStart
  }

  let index = 0
  while (index < raw.length) {
    if (raw[index] === '!' && index + 1 < raw.length) {
      const next = raw[index + 1]
      if (next === 'N') {
        byte += 2
        index += 2
        flushLine(byte)
        continue
      }
      if (next === 'L' || next === 'C' || next === 'R') {
        align = next === 'L' ? '왼' : next === 'C' ? '가운데' : '오른'
        byte += 2
        index += 2
        continue
      }
      if (next === 'c' && /^[0-9A-Fa-f]{6}$/.test(raw.slice(index + 2, index + 8))) {
        const code = raw.slice(index + 2, index + 8).toUpperCase()
        color = code === 'FFFFFF' ? null : `#${code}`
        byte += 8
        index += 8
        continue
      }
    }
    const character = raw[index]
    const advance = byteSizeOf(character) === 2 ? HANGUL_ADVANCE : ASCII_ADVANCE
    const width = advance + (x > 0 ? LETTER_GAP : 0)
    if (maxWidth - x - width < 0 && x > 0) {
      // 넘치면 이 글자 앞에서 줄을 닫는다 — 다음 쪽 끝 바이트는 이 글자의 자리다 (0x6f216 `+0x44 = 0`)
      flushLine(byte)
      continue
    }
    glyphs.push({ character, color, start: byte })
    hasContent = true
    x += width
    byte += byteSizeOf(character)
    index += 1
  }
  if (hasContent || glyphs.length > 0) flushLine(byte)
  return { lines, lineStarts, totalBytes: byte }
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

/** 창 칸 — 높이 +0xea · 첫 줄 +0xeb · 드러난 바이트 +0xe8 · 단계 +0xec */
export interface DialogueState {
  readonly height: number
  readonly firstLine: number
  readonly shown: number
  /** 0 시작 · 1 찍는 중 · 2 쪽 끝까지 · 3 쪽 끝(더 있음) · 4 글 끝 */
  readonly stage: 0 | 1 | 2 | 3 | 4
}

/** 0x7f7cc · 0x7f7d5 — 이벤트 첫 say 는 높이 0 에서, 그 뒤 say 는 다 올라온 높이에서 */
export function startDialogue(slideIn: boolean): DialogueState {
  return { height: slideIn ? 0 : EVENT_DIALOGUE.boxHeight, firstLine: 0, shown: 0, stage: 0 }
}

/** 한 틀 — 0x7fad0(높이) 뒤 다 올라왔으면 0x7fc64~0x7fcea(찍기) */
export function tickDialogue(state: DialogueState, layout: DialogueLayout): DialogueState {
  const height = Math.min(state.height + EVENT_DIALOGUE.slideStep, EVENT_DIALOGUE.boxHeight)
  if (height !== EVENT_DIALOGUE.boxHeight) return { ...state, height }
  const pageEnd = pageEndOf(layout, state.firstLine)
  let { shown, stage } = state
  if (stage === 0) stage = 1
  else if (stage === 2) {
    stage = 1
    shown = pageEnd
  }
  if (stage === 1) {
    shown = Math.min(shown + EVENT_DIALOGUE.bytesPerTick, pageEnd)
    if (shown >= layout.totalBytes) {
      shown = layout.totalBytes
      stage = 4
    } else if (shown === pageEnd) stage = 3
  }
  return { height, firstLine: state.firstLine, shown, stage }
}

/** 확인 키 0x8b804 — `advance` 면 다음 명령으로 */
export function pressDialogue(state: DialogueState): { readonly state: DialogueState; readonly advance: boolean } {
  if (state.stage === 1) return { state: { ...state, stage: 2 }, advance: false }
  if (state.stage === 3) {
    return { state: { ...state, firstLine: state.firstLine + EVENT_DIALOGUE.text.linesPerPage, stage: 1 }, advance: false }
  }
  if (state.stage === 4) return { state, advance: true }
  return { state, advance: false }
}
