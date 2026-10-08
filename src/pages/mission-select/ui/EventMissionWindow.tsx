import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { EVENT_MISSION_WINDOW } from '@/pages/mission-select/lib/missionSelectLayout'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 이벤트 미션 창의 답 — 키 0x1dcb0 이 고른 하위 상태 */
export type EventMissionAnswer = '미션실행' | '미션다운' | '취소'

const OPEN_GROWTH = 2
const CLOSE_SHRINK = 2
const CLOSE_END_WIDTH = 99

type Animation = { readonly kind: '열림'; readonly height: number } | { readonly kind: '닫힘'; readonly width: number } | null

/**
 * **이벤트 미션 창** — 미션 고르기 격자 칸 14 에서 OK 를 누르면 키 0x1daa4(0x1db06)가 연다.
 * ```
 * 0x1db06  칸 == 14 → 0x741a1(창, 높이 0x64, 그리기 0x1dd59, 키 0x1dcb1, this)
 * 그리기   0x1dd58: StrMAINMENU[56] 를 (W/2 − 0x58, H/2 − 0x23, 폭 0xb0)
 *          "!C!cFFFFFF미션실행"(0xcd6f0) (W/2 − 0x50, H/2 + 0x14, 폭 0x50) · "!C!cFFFFFF미션다운"(0xcd704) (W/2, H/2 + 0x14, 폭 0x50)
 *          [this+0xa0] ≠ 0 → 노란 "미션실행"(0xcd718) 을, 0 → 노란 "미션다운"(0xcd72c) 을 같은 자리에 덧그린다
 * 키       0x1dcb0: ← → '4' '6' → [this+0xa0] 뒤집기 · CLR → 닫기, 하위 0
 *          OK · '5' → 닫기, [this+0xa0] ≠ 0 ? ([미션+0xa4] ≠ 0 ? 하위 5 (칸 14 경기) : 하위 3) : 하위 2 (장면 상태 2 = 0x1e798 통신)
 *          ↑ ↓ 는 받지 않는다
 * ```
 * [this+0xa0] 은 장면 진입 0x1d9a4(0x1da06~0x1da0e)가 1(미션실행)로 두고 창은 건드리지 않는다 — 창을 다시 열어도 앞의 고름이 남는다.
 * 창 판·열림·닫힘은 같은 0x741a0 창인 스킬 보상 창(`RewardSkillWindow`)과 같다: 높이 6 에서 ×2 로 100 까지, 닫힘은 폭 ÷2.
 * ⚠️ 뒤 어둡게의 몫은 공용 근사(`MessageBox` 의 dim)다.
 */
export function EventMissionWindow({ isRunSelected, onToggle, onAnswer }: {
  /** [this+0xa0] ≠ 0 — 미션실행 쪽 */
  readonly isRunSelected: boolean
  readonly onToggle: () => void
  /** 닫힘 애니가 끝난 뒤의 답 */
  readonly onAnswer: (answer: EventMissionAnswer) => void
}) {
  const [animation, setAnimation] = useState<Animation>({ kind: '열림', height: EVENT_MISSION_WINDOW.openStartHeight })
  const animationRef = useRef(animation)
  animationRef.current = animation
  const answerRef = useRef<EventMissionAnswer | null>(null)
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer
  const isClosedRef = useRef(false)

  const close = (answer: EventMissionAnswer) => {
    if (animationRef.current?.kind === '닫힘' || isClosedRef.current) return
    answerRef.current = answer
    const closing: Animation = { kind: '닫힘', width: SCREEN_WIDTH }
    animationRef.current = closing
    setAnimation(closing)
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
        return step(next >= EVENT_MISSION_WINDOW.height ? null : { kind: '열림', height: next })
      }
      const next = Math.floor(previous.width / CLOSE_SHRINK)
      step({ kind: '닫힘', width: next })
      if (next > CLOSE_END_WIDTH) return
      isClosedRef.current = true
      onAnswerRef.current(answerRef.current ?? '취소')
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [animationKind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)) {
        event.preventDefault()
        if (animationRef.current?.kind !== '닫힘') onToggle()
        return
      }
      if (['Enter', ' ', '5'].includes(event.key)) {
        event.preventDefault()
        return close(isRunSelected ? '미션실행' : '미션다운')
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        close('취소')
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  const boxTop = (SCREEN_HEIGHT - EVENT_MISSION_WINDOW.height) / 2
  const shownHeight = animation?.kind === '열림' ? animation.height : EVENT_MISSION_WINDOW.height
  const shownWidth = animation?.kind === '닫힘' ? animation.width : SCREEN_WIDTH
  const isOpening = animation?.kind === '열림'
  const { text, run, download } = EVENT_MISSION_WINDOW

  return (
    <div className={boxStyles.dim} role="dialog" aria-label="이벤트 미션" data-testid="이벤트-미션-창">
      <div className={boxStyles.box}
        style={{
          height: shownHeight,
          padding: 0,
          left: Math.floor((SCREEN_WIDTH - shownWidth) / 2),
          width: shownWidth,
          overflow: 'hidden',
        }}>
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c) */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined }}>
          <div className={boxStyles.text} data-part="글"
            style={{ position: 'absolute', left: text.x, top: text.y - boxTop, marginLeft: 0, width: text.width }}>
            <MarkupText raw={text.raw} />
          </div>
          {[run, download].map((label) => {
            const isSelected = (label === run) === isRunSelected
            return (
              <button key={label.raw} type="button" className={boxStyles.text} data-selected={isSelected}
                aria-label={label === run ? '미션실행' : '미션다운'}
                style={{
                  position: 'absolute', left: label.x, top: label.y - boxTop, marginLeft: 0, width: label.width,
                  padding: 0, border: 0, background: 'none',
                }}
                onClick={() => {
                  if (isSelected) close(label === run ? '미션실행' : '미션다운')
                  else onToggle()
                }}>
                <MarkupText raw={isSelected ? label.selectedRaw : label.raw} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
