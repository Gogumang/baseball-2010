import type { RefObject } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { FrameSprite, PressArea } from '@/shared/ui'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import type { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DIALOGUE_CURSOR, EVENT_DIALOGUE_CHOICE } from '@/pages/story/lib/eventDialogue'
import type { DialogueLayout } from '@/pages/story/lib/eventDialogue'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import type { DialogueChoiceList, EventDialogueBoxProps } from '@/pages/story/ui/eventDialogueBox/eventDialogueBoxProps'
import { ChoiceFrame } from '@/pages/story/ui/eventDialogueBox/dialogueBoxShapes'
import { cancelAreaOf, choiceLinesOf, sayLinesOf } from '@/pages/story/ui/eventDialogueBox/dialogueBoxPlacement'
import type { PlacedDialogueLine } from '@/pages/story/ui/eventDialogueBox/dialogueBoxPlacement'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')

/** 안 넘긴 칸의 기본값 — 대치 글 없음 · 선택지 없음 · 아래 열쇠 0 · 키 받음 · 장식 그림 · 앱 틱 */
export function withDialogueBoxDefaults(props: EventDialogueBoxProps) {
  return {
    ...props,
    replacements: props.replacements ?? [],
    choices: props.choices ?? null,
    lowerKey: props.lowerKey ?? 0,
    isActive: props.isActive ?? true,
    showsOrnament: props.showsOrnament ?? true,
    tickInterval: props.tickInterval ?? setAppTickInterval,
  }
}

/** 상자 글(시험 · 읽기 보조) — 선택지 목록이면 줄들을, 아니면 대사를 표식 없이 */
export function dialogueDataTextOf(listChoices: DialogueChoiceList | null, text: string): string {
  return stripGameMarkup(listChoices !== null ? listChoices.lines.join('\n') : text)
}

/** 상자가 다 올라왔을 때만 글줄을 놓는다 — 선택지 목록이면 그 줄들, 아니면 찍는 중인 say 쪽 */
export function placedLinesOf(
  isUp: boolean,
  listChoices: DialogueChoiceList | null,
  replacements: readonly string[],
  layout: DialogueLayout,
  state: Parameters<typeof sayLinesOf>[1],
  textTop: number,
): readonly PlacedDialogueLine[] {
  if (!isUp) return []
  return listChoices !== null ? choiceLinesOf(listChoices, replacements, textTop) : sayLinesOf(layout, state, textTop)
}

/** 넘김 표시 mode_ui 애니 0 의 이번 칸 — 애니를 아직 못 받았으면 null */
export function dialogueCursorStepOf(animations: ReturnType<typeof useAnimations>, cursorUpdates: number) {
  if (animations === null) return null
  return animationStepAt(animations[DIALOGUE_CURSOR.animation] ?? [], cursorUpdates - 1)
}

/**
 * "CLR:SKIP" 장식(0xba19d — mode_ui 21 을 (W, 본체 위)) 자리의 투명 누름 칸 = CLR(−16). 0x8b804 는 say 갈래에서만 −16 을
 * 0x8b7b0 으로 넘기므로 `onCancel` 이 있을 때만 세운다. 칸은 장식이 앉는 윗 띠의 곧은 오른쪽(꺾임 끝 ~ W)
 */
export function cancelPressOf(
  isActive: boolean,
  choices: DialogueChoiceList | null,
  onCancel: (() => void) | undefined,
  onCancelRef: RefObject<(() => void) | undefined>,
  bandTop: number,
) {
  if (!isActive || choices !== null || onCancel === undefined) return null
  return <PressArea label="CLR 건너뛰기" onPress={() => onCancelRef.current?.()} rect={cancelAreaOf(bandTop)} />
}

/** 고른 줄의 노랑 테두리(0x6a978) — 선택지 목록에서 상자가 다 올라왔을 때 */
export function choiceFrameOf(isUp: boolean, listChoices: DialogueChoiceList | null, textTop: number) {
  if (!isUp || listChoices === null) return null
  return <ChoiceFrame top={textTop + listChoices.selected * EVENT_DIALOGUE_CHOICE.lineStep} />
}

/** 0x7fd9a — 넘김 표시 mode_ui 애니 0 (W − 3, H − 3) */
export function dialogueCursorOf(isUp: boolean, cursorStep: ReturnType<typeof dialogueCursorStepOf>, origins: ReturnType<typeof useFrameOrigins>) {
  if (!isUp || cursorStep === null) return null
  return (
    <FrameSprite
      folder={MODE_UI}
      frame={cursorStep.frame}
      origins={origins}
      x={DIALOGUE_CURSOR.x + cursorStep.dx}
      y={DIALOGUE_CURSOR.y + cursorStep.dy}
    />
  )
}
