import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import { TITLE_WINDOW, titleWindowLinesOf } from '@/widgets/title-window/lib/titleWindow'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const OPEN_GROWTH = 2
const CLOSE_SHRINK = 2
const CLOSE_END_WIDTH = 99

type Animation = { readonly kind: '열림'; readonly height: number } | { readonly kind: '닫힘'; readonly width: number } | null

/**
 * **칭호 팝업** 0x1274c — 그리기 0x1afe8 · 키 0x1b1e4 (`TITLE_WINDOW` 주석).
 * 판 · 열림(높이 6 에서 ×2) · 닫힘(폭 ÷2)은 공용 0x741a0 창(`RewardSkillWindow` · `EventMissionWindow`)과 같다.
 * 뒤 어둡게: 나리 장면 0xf684 가 [창+0x24f] = 0 · [창+0x24c] = 1 이라 떠 있는 그리기마다 6/16 (`POPUP_DIM_OPACITY`).
 * 화면 전체가 투명한 누름 칸 "확인" 이다 — 마우스 · 터치로 OK 를 누르는 길.
 */
export function TitleWindow({ title, onKey, onClose }: {
  readonly title: string
  /** 키 0x1b1e4 를 받은 그 자리 — 칭호 비트 · 장착 · 저장 */
  readonly onKey?: () => void
  /** 닫힘 애니가 끝났다 — 팝업 관리자가 대기한 다음 팝업을 띄울 수 있다 */
  readonly onClose: () => void
}) {
  const [animation, setAnimation] = useState<Animation>({ kind: '열림', height: TITLE_WINDOW.openStartHeight })
  const animationRef = useRef(animation)
  animationRef.current = animation
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const isClosedRef = useRef(false)

  const close = () => {
    if (animationRef.current?.kind === '닫힘' || isClosedRef.current) return
    const closing: Animation = { kind: '닫힘', width: SCREEN_WIDTH }
    animationRef.current = closing
    setAnimation(closing)
    onKeyRef.current?.()
  }

  const animationKind = animation?.kind ?? null
  useEffect(() => {
    if (animationKind === null) return undefined
    const timer = window.setInterval(() => {
      const previous = animationRef.current
      if (previous === null || isClosedRef.current) return
      const step = (next: Animation) => {
        animationRef.current = next
        setAnimation(next)
      }
      if (previous.kind === '열림') {
        const next = previous.height * OPEN_GROWTH
        return step(next >= TITLE_WINDOW.height ? null : { kind: '열림', height: next })
      }
      const next = Math.floor(previous.width / CLOSE_SHRINK)
      step({ kind: '닫힘', width: next })
      if (next > CLOSE_END_WIDTH) return
      isClosedRef.current = true
      onCloseRef.current()
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [animationKind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 팝업이 떠 있는 동안은 팝업 관리자가 키를 다 먹는다
      event.stopImmediatePropagation()
      // 0x1b1e4 — OK(−5 · Enter · Space) · '5' 만. CLR 은 안 받는다
      if (!['Enter', ' ', '5'].includes(event.key)) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const lines = titleWindowLinesOf(title)
  const boxTop = (SCREEN_HEIGHT - TITLE_WINDOW.height) / 2
  const shownHeight = animation?.kind === '열림' ? animation.height : TITLE_WINDOW.height
  const shownWidth = animation?.kind === '닫힘' ? animation.width : SCREEN_WIDTH
  const isOpening = animation?.kind === '열림'
  const textStyle = { position: 'absolute', left: TITLE_WINDOW.textLeft, marginLeft: 0, width: TITLE_WINDOW.textWidth } as const

  return (
    <div className={boxStyles.dim} role="dialog" aria-label="칭호" data-testid="칭호-창"
      style={{ background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }}>
      <div className={boxStyles.box}
        style={{
          height: shownHeight,
          padding: 0,
          left: Math.floor((SCREEN_WIDTH - shownWidth) / 2),
          width: shownWidth,
          overflow: 'hidden',
        }}>
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c). 0x1afe8 은 판이 아니라 화면 기준 좌표로 그려 닫히는 동안 글·그림은 제자리에 있다.
            ⚠️ 미확인: 닫히는 동안 판 밖으로 나간 글을 원본이 자르는지 — 웹은 판 폭으로 자른다 */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined, position: 'absolute', top: 0, left: -Math.floor((SCREEN_WIDTH - shownWidth) / 2), width: SCREEN_WIDTH }}>
          <img src={`${IMG_TEXT_FRAMES}/${String(TITLE_WINDOW.headerFrame).padStart(3, '0')}.png`} alt="" data-frame={TITLE_WINDOW.headerFrame}
            style={{
              position: 'absolute',
              left: Math.trunc((SCREEN_WIDTH - TITLE_WINDOW.headerWidth) / 2),
              top: TITLE_WINDOW.headerTop - boxTop,
              imageRendering: 'pixelated',
            }} />
          {lines !== null && (
            <>
              <div className={boxStyles.text} data-part="조건" style={{ ...textStyle, top: TITLE_WINDOW.conditionTop - boxTop }}>
                <MarkupText raw={lines.conditionRaw} />
              </div>
              <div className={boxStyles.text} data-part="이름" style={{ ...textStyle, top: TITLE_WINDOW.nameTop - boxTop }}>
                <MarkupText raw={lines.nameRaw} />
              </div>
            </>
          )}
        </div>
      </div>
      {/* 투명한 누름 칸 — OK */}
      <button type="button" aria-label="확인" onClick={close}
        style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
    </div>
  )
}
