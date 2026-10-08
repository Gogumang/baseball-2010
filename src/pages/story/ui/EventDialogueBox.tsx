import { useEffect, useMemo, useRef, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  EVENT_DIALOGUE, SCREEN_HEIGHT, SCREEN_WIDTH, layoutDialogue, pressDialogue, startDialogue, substituteDialogue,
  tickDialogue, visibleDialogueLinesOf,
} from '@/pages/story/lib/eventDialogue'
import type { DialogueState } from '@/pages/story/lib/eventDialogue'
import * as styles from '@/pages/story/ui/EventDialogueBox.css'

const MODE_UI = './sprites/mode_ui/frames'

interface EventDialogueBoxProps {
  /** 글 — 머리말(`speakerPrefixOf`)까지 붙인 원본 마크업. `%s` 는 `replacements` 로 채운다 */
  readonly raw: string
  readonly replacements?: readonly string[]
  /**
   * 이벤트의 첫 say 면 상자가 아래에서 올라온다(0x8d1f2 의 [mgr+0x2c0] == 0 → 0x7f7cc). 다음 say 는 다 올라온 높이에서
   * 글만 새로 찍는다(0x7f7d5) — 부르는 쪽이 say 마다 `key` 를 바꿔 새로 세운다.
   */
  readonly slideIn: boolean
  /** 글 끝(단계 4)에서 확인 — 다음 명령으로 */
  readonly onAdvance: () => void
  /** 키 · 누르기를 받는가 — 위에 다른 창이 떠 있거나 지금 명령이 say 가 아니면 끈다(0x8b804 는 say · 선택지 명령만 본다) */
  readonly isActive?: boolean
}

/**
 * **이벤트 재생기 say 대사 상자** — 0x7fbc4 · 0x7fad0 · 키 0x8b804 (배치 · 찍기는 `pages/story/lib/eventDialogue`).
 * 확인(Enter · Space · '5' · 누르기): 찍는 중이면 그 쪽을 다 보이고, 쪽 끝이면 다음 쪽, 글 끝이면 다음 명령.
 * 상자가 다 올라오기 전(단계 0)에는 키가 아무 일도 안 한다(0x8b804 는 단계 1 · 3 · 4 만 본다).
 */
export function EventDialogueBox({ raw, replacements = [], slideIn, onAdvance, isActive = true }: EventDialogueBoxProps) {
  const text = useMemo(() => substituteDialogue(raw, replacements), [raw, replacements])
  const layout = useMemo(() => layoutDialogue(text), [text])
  const [state, setState] = useState<DialogueState>(() => startDialogue(slideIn))
  const origins = useFrameOrigins(MODE_UI)

  const layoutRef = useRef(layout)
  layoutRef.current = layout
  useEffect(() => {
    const tick = window.setInterval(() => setState((previous) => tickDialogue(previous, layoutRef.current)), millisecondsPerFrame())
    return () => window.clearInterval(tick)
  }, [])

  const stateRef = useRef(state)
  stateRef.current = state
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance
  const press = () => {
    const pressed = pressDialogue(stateRef.current)
    if (pressed.advance) return onAdvanceRef.current()
    stateRef.current = pressed.state
    setState(pressed.state)
  }

  useEffect(() => {
    if (!isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      event.preventDefault()
      press()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const { height } = state
  const boxTop = SCREEN_HEIGHT - height
  const bandTop = boxTop - EVENT_DIALOGUE.bandHeight
  const bandBottom = bandTop + EVENT_DIALOGUE.bandHeight - 1
  const split = EVENT_DIALOGUE.bandSplit
  const slope = EVENT_DIALOGUE.bandHeight - 1
  const isUp = height === EVENT_DIALOGUE.boxHeight
  const lines = isUp ? visibleDialogueLinesOf(layout, state.firstLine, state.shown) : []

  return (
    <div className={styles.root} role="group" aria-label="대사" data-testid="대사-상자"
      data-text={stripGameMarkup(text)}>
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
      {lines.map((line, index) => (
        <div key={state.firstLine + index} className={styles.textLine} data-part="글줄"
          style={{
            left: EVENT_DIALOGUE.text.x,
            top: boxTop + EVENT_DIALOGUE.text.top + index * EVENT_DIALOGUE.text.lineHeight,
            width: EVENT_DIALOGUE.text.width,
            textAlign: line.align === '가운데' ? 'center' : line.align === '오른' ? 'right' : 'left',
          }}>
          {line.glyphs.map((glyph) => (
            <span key={glyph.start} style={glyph.color === null ? undefined : { color: glyph.color }}>{glyph.character}</span>
          ))}
        </div>
      ))}
    </div>
  )
}
