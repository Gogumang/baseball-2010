import { EVENT_DIALOGUE } from './dialogueBox'
import { pageEndOf } from './dialogueText'
import type { DialogueLayout } from './dialogueText'

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
