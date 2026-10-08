import { FONT_SPACING, LINE_HEIGHT, measurePixelTextWidth } from '@/shared/lib/font'

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
 * **선택지(명령 1)도 같은 상자다** — 0x8d22c → 0x8ba2c(mgr, 명령) · 0x7f7d5(창) · [창+0xe4] = 갈래 수 · 0x7f54c(초상화):
 * ```
 * 0x8ba2c  상자 글 칸 셋(+0xa8 + 0x14k) 을 비우고 [mgr+0xb8] = 갈래 수 · [mgr+0xb9] = 0(고른 줄) ·
 *          칸 k = 0xacad0([mgr+4], [명령+0x1e+2k]) — 스크립트 글표. say 0x8bab8 은 끝에 [창+0xe4] = 1 · [mgr+0xb8] = 1 · [mgr+0xb9] = 0
 * 0x7fbc4  칸 0 글 길이 == 0 이면 아무것도 안 그린다(0x7fbe0 — 상자 · 초상화 모두). [창+0xe4] == 1 이면 위 say 갈래(칸 0 을 찍기),
 *          그 밖(> 0)이면 0x7fd22: 줄 k 를 0x6ef4c(글꼴, 칸 k, x 5, y = H − h + 5 + k × (글꼴 높이 + 3), 폭 W − 20,
 *          바이트 −1(전부) · 줄 −1(전부) · 첫 줄 0 · 줄 높이 −1(= 글꼴 높이 + 줄간)) — 글색은 흰색 하나(0x7fc4c 의 0x6f315),
 *          k == 고른 줄([mgr+0xb9], 둘째 인자)이면 그 뒤 0x6a978(gfx, 3, y − 1, (W − 20) − 10, 글꼴 높이 + 1, RGB(255, 255, 0)) —
 *          노랑 사각 **테두리**(0x6a978 은 폭 · 높이에 1 을 더해 플랫폼 0x14006d8 에 넘긴다). 다 올라온(h == 55) 틀만 그린다.
 * 0x7fd9a  (say · 선택지 모두) 다 올라온 틀이면 mode_ui 애니 0(프레임 22 · 23, 지연 2 · 3)을 (W − 3, H − 3) 에 0xba168 로 그리고
 *          0x93d90 으로 한 칸 돌린다 — 상자 오른쪽 아래 넘김 표시
 * 키 0x8b804 (지금 명령이 선택지일 때): 확인 −5 · '5' → [mgr+0x2bc] = [명령+0x24 + 2 × 고른 줄] · [mgr+8] = 1 · 0x8b0e4(본 이벤트 적기) —
 *          상자 단계와 상관없이 곧바로 · 위 −1 · '2' → (고른 줄 + 갈래 수 − 1) % 갈래 수 · 아래 −2 · '8' → (고른 줄 + 1) % 갈래 수 ·
 *          좌우 · 취소는 아무 일도 없다
 * ```
 * 갈래 수가 1 이면 say 갈래(0x7fc64)로 칸 0 을 찍는다 — 원본 데이터의 선택지는 모두 2 · 3 갈래다.
 * 고른 줄은 확인 뒤에도 다음 say · 선택지가 쓸 때까지 남는다 — 고른 이벤트가 say 없이 창(알림 · 예아니오)을 띄우면 밑의 상자에는
 * 선택지 줄과 고른 줄 테두리가 그대로 남는다. 상자 높이 · 글 칸은 이벤트를 옮겨도(0x8be20) 그대로다.
 * 바이트는 원본 글 CP949 다 — 한글 2 · 영문 1, `!N` · `!C` · `!L` · `!R` 2, `!cRRGGBB` 8 (안 보이는 표시도 찍기 시간을 먹는다).
 * 줄 나누기는 0x6ef4c 그대로(`wrapHelpText` 와 같은 규칙). 글꼴은 0x7fc32 의 0x6ecd0 이 고른 앱 전역 글꼴 [[0x1400070]+0x3c]
 * (자간 1 · 줄간 3) — 글자 폭은 0x6f2e4 → 0x9c52c 로 잰 한 글자 폭(`measurePixelTextWidth`: 한글 9 · 영문 5 · 못 그리는 글자 0).
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

/** 선택지 갈래 0x7fd22 */
export const EVENT_DIALOGUE_CHOICE = {
  /** 0x7fd32~0x7fd3a — 줄 사이 = 글꼴 높이 [글꼴+0x6c](11) + 3 */
  lineStep: LINE_HEIGHT + 3,
  /**
   * 0x7fd66~0x7fd88 → 0x6a978(gfx, 3, y − 1, (W − 20) − 10, 글꼴 높이 + 1, 노랑) — 0x6a978 은 폭 · 높이에 1 을 더해 넘기므로
   * 테두리는 x 3 부터 W − 29 칸 · y − 1 부터 글꼴 높이 + 2 칸이다 (플랫폼 0x14006d8 이 받은 폭 · 높이를 칸 수로 본다 — 유력)
   */
  cursor: {
    x: 3,
    top: -1,
    width: SCREEN_WIDTH - 0x14 - 10 + 1,
    height: LINE_HEIGHT + 1 + 1,
    color: '#FFFF00',
  },
} as const

/** 0x7fd9a~0x7fde2 — 상자 오른쪽 아래 넘김 표시: mode_ui 애니 0 을 (W − 3, H − 3) 에 */
export const DIALOGUE_CURSOR = {
  x: SCREEN_WIDTH - 3,
  y: SCREEN_HEIGHT - 3,
  animation: 0,
} as const

/**
 * **이벤트 장면의 공용 창 뒤 어둡게** — 창 [0x140005c] 그리기 0x746cc (직접 떴다):
 * ```
 * 0x746d8  [창+0x24c] == 0 이면 안 어둡게
 * 0x746e4  [창+0x24d] ≠ 0 이고 [창+0x24e] ≠ 0 → 어둡게 / [창+0x24e] ≠ 0 → 안 어둡게 / 그 밖([창+0x24e] == 0) → 어둡게
 * 0x74704  0xbaf8d · 색 (0, 0, 0) · [0x15605d0](0, 0, W, H, 검정, 단계 5) — 색 덮기 0x9b3f4 는 색 몫 (단계 + 1)/16 · 그 뒤 [창+0x24d] = 0
 * ```
 * [창+0x24e] 은 창을 띄울 때(0x74ef4 의 0x7503c · 0x741a0 의 0x74228) 장면이 세운 [창+0x24f] 를 옮긴 값이다. 이벤트를 트는 두
 * 장면 — 나리(관리 · 114, 0xf684 의 0xf688~0xf69a)와 시즌(0x3b14 의 0x3b1c~0x3b2e) — 은 장면을 세울 때 [창+0x24f] = 0 ·
 * [창+0x24c] = 1 로 둔다. 곧 이벤트의 알림 · 예아니오 · 목표 · 평가 변화 창은 **떠 있는 그리기마다** 그 틀의 장면(밑그림 ·
 * 대사 상자 · 초상화) 위를 검정 6/16 으로 덮는다(장면을 멈추고 한 번만 덮는 [창+0x24f] = 1 은 경기 장면 0x3301c 같은 곳이다).
 */
export const EVENT_WINDOW_DIM_OPACITY = (5 + 1) / 16

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

/** 0x6ecd0 — 글상자는 앱 전역 글꼴(자간 +0x66 = 1) */
const LETTER_GAP = FONT_SPACING.app.letterGap

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
    const advance = measurePixelTextWidth(character)
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

/** 0x7f7d4 · 0x7f7d5 — 글 찍기를 처음으로(첫 줄 0 · 드러난 바이트 0 · 단계 0). 높이는 그대로 */
export function restartDialogueText(state: DialogueState): DialogueState {
  return { ...state, firstLine: 0, shown: 0, stage: 0 }
}

/** 0x7f7cc — 상자 높이 0 (다음 그리기부터 다시 오른다) */
export function lowerDialogueBox(state: DialogueState): DialogueState {
  return { ...state, height: 0 }
}

/**
 * 한 틀 — 0x7fad0(높이) 뒤 다 올라왔으면 0x7fc64~0x7fcea(찍기). 그리기가 곧 갱신이다 — 0x7fbc4 가 그릴 때마다 높이를 올리고
 * 글을 찍으므로 화면에 나가는 것은 늘 이 함수를 거친 값이다. `layout` 이 null 이면 선택지 갈래(0x7fd22) — 찍기 칸을 안 건드린다.
 */
export function tickDialogue(state: DialogueState, layout: DialogueLayout | null): DialogueState {
  const height = Math.min(state.height + EVENT_DIALOGUE.slideStep, EVENT_DIALOGUE.boxHeight)
  if (height !== EVENT_DIALOGUE.boxHeight || layout === null) return { ...state, height }
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
