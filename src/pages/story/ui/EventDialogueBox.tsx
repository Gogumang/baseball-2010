import { useMemo } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { EVENT_DIALOGUE, SCREEN_HEIGHT, SCREEN_WIDTH, layoutDialogue, substituteDialogue } from '@/pages/story/lib/eventDialogue'
import type { DialogueLine } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/story/ui/EventDialogueBox.css'
import type { EventDialogueBoxProps } from '@/pages/story/ui/eventDialogueBox/eventDialogueBoxProps'
import { useDialogueTyping } from '@/pages/story/ui/eventDialogueBox/useDialogueTyping'
import { useDialogueKeys } from '@/pages/story/ui/eventDialogueBox/useDialogueKeys'
import { DialogueBoxBody } from '@/pages/story/ui/eventDialogueBox/dialogueBoxShapes'
import {
  MODE_UI,
  cancelPressOf,
  choiceFrameOf,
  dialogueCursorOf,
  dialogueCursorStepOf,
  dialogueDataTextOf,
  placedLinesOf,
  withDialogueBoxDefaults,
} from '@/pages/story/ui/eventDialogueBox/dialogueBoxParts'
const TEXT_ALIGN_OF: Readonly<Record<DialogueLine['align'], 'left' | 'center' | 'right'>> = { 왼: 'left', 가운데: 'center', 오른: 'right' }

/**
 * **이벤트 재생기 대사 상자** — 0x7fbc4 · 0x7fad0 · 키 0x8b804 (배치 · 찍기는 `pages/story/lib/eventDialogue`).
 * say 확인(Enter · Space · '5' · 누르기): 찍는 중이면 그 쪽을 다 보이고, 쪽 끝이면 다음 쪽, 글 끝이면 다음 명령.
 * 상자가 다 올라오기 전(단계 0)에는 키가 아무 일도 안 한다(0x8b804 는 단계 1 · 3 · 4 만 본다).
 * 선택지는 같은 상자 안 글줄이다 — 위 · 아래(↑↓ · '2' · '8')로 고르고 확인으로 간다. 고른 줄은 노랑 테두리(0x6a978).
 * 웹은 줄을 눌러도 그 줄을 고른다(원본에는 누르기가 없다).
 */
export function EventDialogueBox(props: EventDialogueBoxProps) {
  const {
    raw,
    replacements,
    choices,
    slideIn,
    textKey,
    lowerKey,
    onAdvance,
    isActive,
    onCancel,
    onChoiceMove,
    onChoiceConfirm,
    showsOrnament,
    tickInterval,
    deferPress,
  } = withDialogueBoxDefaults(props)
  const text = useMemo(() => substituteDialogue(raw, replacements), [raw, replacements])
  const isList = choices !== null && choices.lines.length !== 1
  const layout = useMemo(() => layoutDialogue(text), [text])
  const typingLayout = isList ? null : layout
  const origins = useFrameOrigins(MODE_UI)
  const animations = useAnimations(MODE_UI)
  const [state, cursorUpdates, pressText] = useDialogueTyping(slideIn, typingLayout, textKey ?? raw, lowerKey, tickInterval)
  const [press, onCancelRef] = useDialogueKeys(choices, isActive, pressText, onAdvance, onCancel, onChoiceMove, onChoiceConfirm, deferPress)

  // 0x7fbe0 — 상자 글 칸 0 이 비면 아무것도 안 그린다
  if (raw === '') return null

  const { height } = state
  const isUp = height === EVENT_DIALOGUE.boxHeight
  const boxTop = SCREEN_HEIGHT - height
  const bandTop = boxTop - EVENT_DIALOGUE.bandHeight
  const textTop = boxTop + EVENT_DIALOGUE.text.top
  const listChoices = isList ? choices : null
  const placed = placedLinesOf(isUp, listChoices, replacements, layout, state, textTop)
  const cursorStep = dialogueCursorStepOf(animations, cursorUpdates)

  return (
    <div className={styles.root} role="group" aria-label="대사" data-testid="대사-상자" data-text={dialogueDataTextOf(listChoices, text)}>
      <DialogueBoxBody height={height} />
      {/* 0xba19d 장식 — mode_ui 프레임 21 을 (W, 본체 위) */}
      {showsOrnament && <FrameSprite folder={MODE_UI} frame={EVENT_DIALOGUE.ornamentFrame} origins={origins} x={SCREEN_WIDTH} y={boxTop} />}
      <button
        type="button"
        className={styles.hit}
        aria-label="대사 넘기기"
        style={{ height: height + EVENT_DIALOGUE.bandHeight }}
        onClick={isActive ? press : undefined}
      />
      {cancelPressOf(isActive, choices, onCancel, onCancelRef, bandTop)}
      {placed.map(({ key, line, top, choice }) => (
        <div
          key={key}
          className={styles.textLine}
          data-part="글줄"
          role={choice === null ? undefined : 'option'}
          aria-selected={choice === null ? undefined : choice === choices?.selected}
          style={{
            left: EVENT_DIALOGUE.text.x,
            top,
            width: EVENT_DIALOGUE.text.width,
            textAlign: TEXT_ALIGN_OF[line.align],
            pointerEvents: choice === null || !isActive ? undefined : 'auto',
          }}
          onClick={choice === null || !isActive ? undefined : () => onChoiceConfirm?.(choice)}
        >
          {line.glyphs.map((glyph) => (
            <span key={glyph.start} style={glyph.color === null ? undefined : { color: glyph.color }}>
              {glyph.character}
            </span>
          ))}
        </div>
      ))}
      {choiceFrameOf(isUp, listChoices, textTop)}
      {dialogueCursorOf(isUp, cursorStep, origins)}
    </div>
  )
}
