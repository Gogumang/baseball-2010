import {
  EVENT_DIALOGUE,
  EVENT_DIALOGUE_CHOICE,
  SCREEN_WIDTH,
  layoutDialogue,
  substituteDialogue,
  visibleDialogueLinesOf,
} from '@/pages/story/lib/eventDialogue'
import type { DialogueLayout, DialogueLine, DialogueState } from '@/pages/story/lib/eventDialogue'
import type { DialogueChoiceList } from './eventDialogueBoxProps'

/** 그릴 줄 — y 와 함께. `choice` 는 선택지 갈래 번호(say 줄은 null) */
export interface PlacedDialogueLine {
  readonly key: string
  readonly line: DialogueLine
  readonly top: number
  readonly choice: number | null
}

/** 0x7fd22 — 갈래 k 는 y + k × (글꼴 높이 + 3) 에 제 글을 모두(줄 높이 14) 그린다 */
export function choiceLinesOf(choices: DialogueChoiceList, replacements: readonly string[], textTop: number): PlacedDialogueLine[] {
  return choices.lines.flatMap((line, choice) => {
    const top = textTop + choice * EVENT_DIALOGUE_CHOICE.lineStep
    return layoutDialogue(substituteDialogue(line, replacements)).lines.map((wrapped, index) => ({
      key: `${choice}:${index}`,
      line: wrapped,
      top: top + index * EVENT_DIALOGUE.text.lineHeight,
      choice,
    }))
  })
}

/** say 갈래 — 지금 쪽(첫 줄부터 3줄)에서 드러난 글자 */
export function sayLinesOf(layout: DialogueLayout, state: DialogueState, textTop: number): PlacedDialogueLine[] {
  return visibleDialogueLinesOf(layout, state.firstLine, state.shown).map((line, index) => ({
    key: String(state.firstLine + index),
    line,
    top: textTop + index * EVENT_DIALOGUE.text.lineHeight,
    choice: null,
  }))
}

const SPLIT_END = EVENT_DIALOGUE.bandSplit + EVENT_DIALOGUE.bandHeight - 1

/** "CLR:SKIP" 장식 자리 — 윗 띠의 곧은 오른쪽(꺾임 끝 ~ W) */
export const cancelAreaOf = (bandTop: number) => ({
  x: SPLIT_END,
  y: bandTop,
  width: SCREEN_WIDTH - SPLIT_END,
  height: EVENT_DIALOGUE.bandHeight,
})
