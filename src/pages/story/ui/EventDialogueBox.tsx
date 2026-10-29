import { useMemo } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { FrameSprite, PressArea } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  DIALOGUE_CURSOR,
  EVENT_DIALOGUE,
  EVENT_DIALOGUE_CHOICE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  layoutDialogue,
  substituteDialogue,
} from '@/pages/story/lib/eventDialogue'
import type { DialogueLine } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/story/ui/EventDialogueBox.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { EventDialogueBoxProps } from '@/pages/story/ui/eventDialogueBox/eventDialogueBoxProps'
import { useDialogueTyping } from '@/pages/story/ui/eventDialogueBox/useDialogueTyping'
import { useDialogueKeys } from '@/pages/story/ui/eventDialogueBox/useDialogueKeys'
import { ChoiceFrame, DialogueBoxBody } from '@/pages/story/ui/eventDialogueBox/dialogueBoxShapes'
import { cancelAreaOf, choiceLinesOf, sayLinesOf } from '@/pages/story/ui/eventDialogueBox/dialogueBoxPlacement'
import type { PlacedDialogueLine } from '@/pages/story/ui/eventDialogueBox/dialogueBoxPlacement'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const TEXT_ALIGN_OF: Readonly<Record<DialogueLine['align'], 'left' | 'center' | 'right'>> = { 왼: 'left', 가운데: 'center', 오른: 'right' }

/**
 * **이벤트 재생기 대사 상자** — 0x7fbc4 · 0x7fad0 · 키 0x8b804 (배치 · 찍기는 `pages/story/lib/eventDialogue`).
 * say 확인(Enter · Space · '5' · 누르기): 찍는 중이면 그 쪽을 다 보이고, 쪽 끝이면 다음 쪽, 글 끝이면 다음 명령.
 * 상자가 다 올라오기 전(단계 0)에는 키가 아무 일도 안 한다(0x8b804 는 단계 1 · 3 · 4 만 본다).
 * 선택지는 같은 상자 안 글줄이다 — 위 · 아래(↑↓ · '2' · '8')로 고르고 확인으로 간다. 고른 줄은 노랑 테두리(0x6a978).
 * 웹은 줄을 눌러도 그 줄을 고른다(원본에는 누르기가 없다).
 */
export function EventDialogueBox({
  raw,
  replacements = [],
  choices = null,
  slideIn,
  textKey,
  lowerKey = 0,
  onAdvance,
  isActive = true,
  onCancel,
  onChoiceMove,
  onChoiceConfirm,
  showsOrnament = true,
  tickInterval = setAppTickInterval,
  deferPress,
}: EventDialogueBoxProps) {
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
  let placed: readonly PlacedDialogueLine[] = []
  if (isUp) placed = listChoices !== null ? choiceLinesOf(listChoices, replacements, textTop) : sayLinesOf(layout, state, textTop)
  const cursorStep = animations === null ? null : animationStepAt(animations[DIALOGUE_CURSOR.animation] ?? [], cursorUpdates - 1)
  const selectedTop = listChoices !== null ? textTop + listChoices.selected * EVENT_DIALOGUE_CHOICE.lineStep : null

  return (
    <div
      className={styles.root}
      role="group"
      aria-label="대사"
      data-testid="대사-상자"
      data-text={stripGameMarkup(listChoices !== null ? listChoices.lines.join('\n') : text)}
    >
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
      {/*
        "CLR:SKIP" 장식(0xba19d — mode_ui 21 을 (W, 본체 위)) 자리의 투명 누름 칸 = CLR(−16). 0x8b804 는 say 갈래에서만 −16 을
        0x8b7b0 으로 넘기므로 `onCancel` 이 있을 때만 세운다. 칸은 장식이 앉는 윗 띠의 곧은 오른쪽(꺾임 끝 ~ W)
      */}
      {isActive && choices === null && onCancel !== undefined && (
        <PressArea label="CLR 건너뛰기" onPress={() => onCancelRef.current?.()} rect={cancelAreaOf(bandTop)} />
      )}
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
      {isUp && selectedTop !== null && <ChoiceFrame top={selectedTop} />}
      {isUp && cursorStep !== null && (
        // 0x7fd9a — 넘김 표시 mode_ui 애니 0 (W − 3, H − 3)
        <FrameSprite
          folder={MODE_UI}
          frame={cursorStep.frame}
          origins={origins}
          x={DIALOGUE_CURSOR.x + cursorStep.dx}
          y={DIALOGUE_CURSOR.y + cursorStep.dy}
        />
      )}
    </div>
  )
}
