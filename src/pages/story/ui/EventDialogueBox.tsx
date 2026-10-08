import { useEffect, useMemo, useRef, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  DIALOGUE_CURSOR, EVENT_DIALOGUE, EVENT_DIALOGUE_CHOICE, SCREEN_HEIGHT, SCREEN_WIDTH, layoutDialogue, lowerDialogueBox,
  pressDialogue, restartDialogueText, startDialogue, substituteDialogue, tickDialogue, visibleDialogueLinesOf,
} from '@/pages/story/lib/eventDialogue'
import type { DialogueLayout, DialogueLine, DialogueState } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/story/ui/EventDialogueBox.css'

const MODE_UI = './sprites/mode_ui/frames'

/** 선택지 갈래(0x7fd22) — [창+0xe4] = 갈래 수 ≠ 1 */
export interface DialogueChoiceList {
  /** 상자 글 칸 k = 갈래 k 의 글 (0x8ba2c) */
  readonly lines: readonly string[]
  /** [mgr+0xb9] — 노랑 테두리를 두를 줄 */
  readonly selected: number
}

interface EventDialogueBoxProps {
  /**
   * 상자 글 칸 0 — say 면 머리말(`speakerPrefixOf`)까지 붙인 원본 마크업, 선택지면 첫 갈래 글. `%s` 는 `replacements` 로 채운다.
   * 빈 글이면 0x7fbc4 가 아무것도 안 그린다(0x7fbe0 — 상자 · 넘김 표시 모두).
   */
  readonly raw: string
  readonly replacements?: readonly string[]
  /** 선택지 갈래로 그린다(갈래 수 ≠ 1). 없으면 say 갈래 — 칸 0 을 찍는다 */
  readonly choices?: DialogueChoiceList | null
  /**
   * 처음 세울 때 상자가 아래에서 올라오는가(높이 0 에서). 거짓이면 다 올라온 높이다.
   * 세운 뒤의 높이는 상자 객체([mgr+0xb4])처럼 이어 간다 — say · 선택지가 바뀌어도 그대로다.
   */
  readonly slideIn: boolean
  /** 바뀌면 글 찍기를 처음으로 — say · 선택지 명령이 돌 때(0x7f7d5). 안 주면 `raw` 가 바뀔 때 */
  readonly textKey?: string
  /**
   * 바뀌면 상자를 내린다 — 높이 0 · 글 찍기 처음으로(이벤트의 첫 say 0x8d1f2 의 0x7f7cc, 화면효과 6 · 7 의 '끝' 0x7f7d4 · 0x7f7cc).
   * 그 그리기에서 곧바로 한 칸(15) 오른다.
   */
  readonly lowerKey?: number
  /** say 갈래의 글 끝(단계 4)에서 확인 — 다음 명령으로 */
  readonly onAdvance: () => void
  /** 키 · 누르기를 받는가 — 위에 다른 창이 떠 있거나 지금 명령이 say · 선택지가 아니면 끈다(0x8b804 는 say · 선택지 명령만 본다) */
  readonly isActive?: boolean
  /** 선택지 위 · 아래 — 고른 줄을 (고른 줄 ± 1) % 갈래 수 로 */
  readonly onChoiceMove?: (selected: number) => void
  /** 선택지 확인 — 고른 줄의 갈 이벤트로. 상자 단계와 상관없이 곧바로 받는다 */
  readonly onChoiceConfirm?: (selected: number) => void
}

/** 그리기 한 번(0x7fbc4)을 거친 상자 — 명령이 돌거나 상자를 내린 틀에도 그 틀의 그리기가 높이를 올리고 글을 찍는다 */
const drawnState = (state: DialogueState, layout: DialogueLayout | null) => tickDialogue(state, layout)

/**
 * **이벤트 재생기 대사 상자** — 0x7fbc4 · 0x7fad0 · 키 0x8b804 (배치 · 찍기는 `pages/story/lib/eventDialogue`).
 * say 확인(Enter · Space · '5' · 누르기): 찍는 중이면 그 쪽을 다 보이고, 쪽 끝이면 다음 쪽, 글 끝이면 다음 명령.
 * 상자가 다 올라오기 전(단계 0)에는 키가 아무 일도 안 한다(0x8b804 는 단계 1 · 3 · 4 만 본다).
 * 선택지는 같은 상자 안 글줄이다 — 위 · 아래(↑↓ · '2' · '8')로 고르고 확인으로 간다. 고른 줄은 노랑 테두리(0x6a978).
 * 웹은 줄을 눌러도 그 줄을 고른다(원본에는 누르기가 없다).
 */
export function EventDialogueBox({
  raw, replacements = [], choices = null, slideIn, textKey, lowerKey = 0, onAdvance, isActive = true, onChoiceMove,
  onChoiceConfirm,
}: EventDialogueBoxProps) {
  const text = useMemo(() => substituteDialogue(raw, replacements), [raw, replacements])
  const isList = choices !== null && choices.lines.length !== 1
  const layout = useMemo(() => layoutDialogue(text), [text])
  const typingLayout = isList ? null : layout
  const [state, setState] = useState<DialogueState>(() => drawnState(startDialogue(slideIn), typingLayout))
  const origins = useFrameOrigins(MODE_UI)
  const animations = useAnimations(MODE_UI)
  /** 넘김 표시 애니(0x93d90)를 그린 횟수 — 다 올라온 그리기마다 하나 (그린 뒤 한 칸 돌린다) */
  const [cursorUpdates, setCursorUpdates] = useState(() => (state.height === EVENT_DIALOGUE.boxHeight ? 1 : 0))

  // 명령이 돈 틀 — 글 찍기를 처음으로 돌리고 그 틀의 그리기를 거친다 (React 의 "props 가 바뀌면 상태를 맞춘다")
  const shownTextKey = textKey ?? raw
  const [textKeySeen, setTextKeySeen] = useState(shownTextKey)
  const [lowerKeySeen, setLowerKeySeen] = useState(lowerKey)
  if (lowerKey !== lowerKeySeen || shownTextKey !== textKeySeen) {
    const lowered = lowerKey !== lowerKeySeen ? lowerDialogueBox(state) : state
    const drawn = drawnState(restartDialogueText(lowered), typingLayout)
    setLowerKeySeen(lowerKey)
    setTextKeySeen(shownTextKey)
    setState(drawn)
    if (drawn.height === EVENT_DIALOGUE.boxHeight) setCursorUpdates((count) => count + 1)
  }

  const stateRef = useRef(state)
  stateRef.current = state
  const layoutRef = useRef(typingLayout)
  layoutRef.current = typingLayout
  useEffect(() => {
    const tick = window.setInterval(() => {
      const next = tickDialogue(stateRef.current, layoutRef.current)
      stateRef.current = next
      setState(next)
      // 0x7fd9a — 다 올라온 그리기마다 넘김 표시를 그리고 한 칸 돌린다(0x93d90)
      if (next.height === EVENT_DIALOGUE.boxHeight) setCursorUpdates((count) => count + 1)
    }, millisecondsPerFrame())
    return () => window.clearInterval(tick)
  }, [])
  const isUp = state.height === EVENT_DIALOGUE.boxHeight
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance
  const choicesRef = useRef(choices)
  choicesRef.current = choices
  const onChoiceMoveRef = useRef(onChoiceMove)
  onChoiceMoveRef.current = onChoiceMove
  const onChoiceConfirmRef = useRef(onChoiceConfirm)
  onChoiceConfirmRef.current = onChoiceConfirm
  const press = () => {
    const list = choicesRef.current
    if (list !== null) return onChoiceConfirmRef.current?.(list.selected)
    const pressed = pressDialogue(stateRef.current)
    if (pressed.advance) return onAdvanceRef.current()
    stateRef.current = pressed.state
    setState(pressed.state)
  }

  useEffect(() => {
    if (!isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const list = choicesRef.current
      if (list !== null && list.lines.length > 0) {
        // 0x8b8de · 0x8b8f8 — 위 −1 · '2' / 아래 −2 · '8', 갈래 수로 돈다(0xca910)
        const count = list.lines.length
        if (event.key === 'ArrowUp' || event.key === '2') {
          event.preventDefault()
          return onChoiceMoveRef.current?.((list.selected + count - 1) % count)
        }
        if (event.key === 'ArrowDown' || event.key === '8') {
          event.preventDefault()
          return onChoiceMoveRef.current?.((list.selected + 1) % count)
        }
      }
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      event.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  // 0x7fbe0 — 상자 글 칸 0 이 비면 아무것도 안 그린다
  if (raw === '') return null

  const { height } = state
  const boxTop = SCREEN_HEIGHT - height
  const bandTop = boxTop - EVENT_DIALOGUE.bandHeight
  const bandBottom = bandTop + EVENT_DIALOGUE.bandHeight - 1
  const split = EVENT_DIALOGUE.bandSplit
  const slope = EVENT_DIALOGUE.bandHeight - 1
  const textTop = boxTop + EVENT_DIALOGUE.text.top
  /** 그릴 줄 — y 와 함께 */
  const placed: { readonly key: string; readonly line: DialogueLine; readonly top: number; readonly choice: number | null }[] = []
  if (isUp && choices !== null && isList) {
    // 0x7fd22 — 갈래 k 는 y + k × (글꼴 높이 + 3) 에 제 글을 모두(줄 높이 14) 그린다
    choices.lines.forEach((line, choice) => {
      const top = textTop + choice * EVENT_DIALOGUE_CHOICE.lineStep
      layoutDialogue(substituteDialogue(line, replacements)).lines.forEach((wrapped, index) => {
        placed.push({ key: `${choice}:${index}`, line: wrapped, top: top + index * EVENT_DIALOGUE.text.lineHeight, choice })
      })
    })
  } else if (isUp) {
    visibleDialogueLinesOf(layout, state.firstLine, state.shown).forEach((line, index) => {
      placed.push({ key: String(state.firstLine + index), line, top: textTop + index * EVENT_DIALOGUE.text.lineHeight, choice: null })
    })
  }
  const cursorStep = animations === null ? null : animationStepAt(animations[DIALOGUE_CURSOR.animation] ?? [], cursorUpdates - 1)
  const selectedTop = isList && choices !== null ? textTop + choices.selected * EVENT_DIALOGUE_CHOICE.lineStep : null

  return (
    <div className={styles.root} role="group" aria-label="대사" data-testid="대사-상자"
      data-text={stripGameMarkup(isList && choices !== null ? choices.lines.join('\n') : text)}>
      <svg className={styles.layer} style={{ left: 0, top: 0 }} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
        viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`} shapeRendering="crispEdges">
        {/* 0x7cfc8 윗 띠 — 바깥 #12307E · 안 #1D44A8 · 꺾임 계단(높이 − 1 칸) · 밝은 줄 #3563D7 */}
        <rect data-part="띠" x={0} y={bandTop} width={SCREEN_WIDTH} height={EVENT_DIALOGUE.bandHeight} fill={ORIGINAL_COLORS.bandDark} />
        <rect x={0} y={bandTop + 1} width={SCREEN_WIDTH} height={EVENT_DIALOGUE.bandHeight - 2} fill={ORIGINAL_COLORS.panelDeep} />
        {Array.from({ length: slope }, (_unused, index) => (
          <g key={index}>
            <rect x={split + index} y={bandBottom - index} width={1} height={1} fill={ORIGINAL_COLORS.bandDark} />
            <rect x={split + index + 1} y={bandBottom - index} width={1} height={1} fill={ORIGINAL_COLORS.bandLight} />
          </g>
        ))}
        <rect x={split + slope} y={bandTop + 1} width={SCREEN_WIDTH - split - slope} height={1} fill={ORIGINAL_COLORS.bandLight} />
        {/* 0xb9f74 본체 — 검정 알파 0xB4 */}
        <rect data-part="본체" x={0} y={boxTop} width={SCREEN_WIDTH} height={height} fill="#000000" fillOpacity={EVENT_DIALOGUE.boxAlpha} />
      </svg>
      {/* 0xba19d 장식 — mode_ui 프레임 21 을 (W, 본체 위) */}
      <FrameSprite folder={MODE_UI} frame={EVENT_DIALOGUE.ornamentFrame} origins={origins} x={SCREEN_WIDTH} y={boxTop} />
      <button type="button" className={styles.hit} aria-label="대사 넘기기"
        style={{ height: height + EVENT_DIALOGUE.bandHeight }} onClick={isActive ? press : undefined} />
      {placed.map(({ key, line, top, choice }) => (
        <div key={key} className={styles.textLine} data-part="글줄"
          role={choice === null ? undefined : 'option'}
          aria-selected={choice === null ? undefined : choice === choices?.selected}
          style={{
            left: EVENT_DIALOGUE.text.x,
            top,
            width: EVENT_DIALOGUE.text.width,
            textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
            pointerEvents: choice === null || !isActive ? undefined : 'auto',
          }}
          onClick={choice === null || !isActive ? undefined : () => onChoiceConfirm?.(choice)}>
          {line.glyphs.map((glyph) => (
            <span key={glyph.start} style={glyph.color === null ? undefined : { color: glyph.color }}>{glyph.character}</span>
          ))}
        </div>
      ))}
      {isUp && selectedTop !== null && (
        // 0x6a978 — 고른 줄 노랑 테두리 (글 뒤에 그린다)
        <svg className={styles.layer} style={{ left: 0, top: 0 }} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
          viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`} shapeRendering="crispEdges" data-part="고른줄">
          <rect x={EVENT_DIALOGUE_CHOICE.cursor.x + 0.5} y={selectedTop + EVENT_DIALOGUE_CHOICE.cursor.top + 0.5}
            width={EVENT_DIALOGUE_CHOICE.cursor.width - 1} height={EVENT_DIALOGUE_CHOICE.cursor.height - 1}
            fill="none" stroke={EVENT_DIALOGUE_CHOICE.cursor.color} strokeWidth={1} />
        </svg>
      )}
      {isUp && cursorStep !== null && (
        // 0x7fd9a — 넘김 표시 mode_ui 애니 0 (W − 3, H − 3)
        <FrameSprite folder={MODE_UI} frame={cursorStep.frame} origins={origins}
          x={DIALOGUE_CURSOR.x + cursorStep.dx} y={DIALOGUE_CURSOR.y + cursorStep.dy} />
      )}
    </div>
  )
}
