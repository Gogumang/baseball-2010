import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import * as styles from '@/shared/ui/MessageBox/MessageBox.css'

interface MessageBoxProps {
  /** 원문 마크업 (StrMODE) */
  readonly text: string
  /**
   * 버튼 이름. 화면에는 **글자가 아니라 `ui/popup.pzx` 그림**이 나가고(F-1), 이 값은 읽기 보조용이다.
   * 하나면 알림(프레임 0 "OK"), 둘이면 예/아니오다.
   */
  readonly buttons: readonly string[]
  /**
   * **선수 목록 창**(0x62568)처럼 칸을 **글자로** 골라야 하는 자리에 쓴다.
   *
   * 보통 상자의 버튼은 글자가 아니라 `ui/popup.pzx` 그림(1 "예" · 2 "아니오")이라,
   * 예/아니오가 아닌 것을 고르게 하려면 그림을 쓸 수 없다. 이 값을 주면 그림 대신
   * 이 글자들을 세로로 그린다 — 칸 수와 순서는 `buttons` 와 같아야 한다.
   */
  readonly listItems?: readonly string[]
  /** 누른 버튼 번호 */
  readonly onAnswer: (index: number) => void
}

/**
 * 메시지 상자 (0xbbef8 → 0x74ef4 배치 · 0x746cc 그리기 — layout-re 4차, 판·위치 바이트 확인).
 * 화면을 검정 반투명으로 덮고, 폭 240 띠를 세로 가운데에 둔다. 글은 (45, y+20) 부터 폭 150, 줄 간격 14.
 * 버튼은 `ui/popup.pzx` 프레임 그림이고 첫 버튼이 기본 선택이다 (F-1 확정) — "확인" 이 아니라 **"OK"**,
 * 고른 칸은 노란 글자가 아니라 **주황 그림 6·7**(49×23)이다.
 *
 * 열림·닫힘 애니메이션은 F-1 1-4(확정)다 — 아래 `OPEN_*` · `CLOSE_*` 참고.
 */

/**
 * **열림** (0x75006 · 0x75556~0x75588): 그리는 높이 [+0x212] = **10** 에서 시작해 매 갱신 **×2**,
 * 두 배가 목표 높이 이상이면 목표로 맞추고 플래그를 끈다 (한 줄 상자 79 면 10→20→40→79).
 * 상자는 늘 `(화면높이 − 현재높이)/2` 에 그려져 **세로 가운데에서 위아래로 펼쳐지고**,
 * 펼치는 동안에는 글·버튼을 그리지 않는다 (0x7479c).
 */
const OPEN_START_HEIGHT = 10
const OPEN_GROWTH = 2

/**
 * **닫힘** (0x7558a~0x755d8): [+0x215] 가 켜지면 매 갱신 폭 [+0x210] 을 **÷2**,
 * **99 이하**가 되면 닫고 콜백을 부른다 (240→120→60 두 갱신).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 줄어드는 폭을 화면 어느 쪽에 붙이는지가 원본 노트에 없다.
 *    가로 가운데로 모았다.
 * ⚠️ 레이아웃이 없는 환경(측정 높이 0 — 테스트 등)에서는 두 애니메이션을 모두 건너뛰고
 *    **답을 그 자리에서 넘긴다**. props 계약(`onAnswer` 를 바로 부르는 것)을 지키기 위함이다.
 */
const CLOSE_START_WIDTH = 240
const CLOSE_SHRINK = 2
const CLOSE_END_WIDTH = 99

type BoxAnimation =
  | { readonly kind: '열림'; readonly height: number }
  | { readonly kind: '닫힘'; readonly width: number; readonly answer: number }
  | null
const POPUP = './sprites/popup/frames'
/**
 * 버튼은 글자가 아니라 `ui/popup.pzx` 프레임 그림이다 (F-1 확정).
 *   알림(버튼 하나) = 프레임 0 "OK" · 예/아니오 = 1 "예" · 2 "아니오" (41×15)
 *   고른 칸은 주황 그림 6·7 (49×23) 로 바뀐다 — 노란 글자색이 아니었다.
 */
const NOTICE_FRAME = 0
const YES_NO_FRAMES = [1, 2]
const YES_NO_SELECTED_FRAMES = [6, 7]
/** 선택 그림 원점 (−4,−4) */
const SELECTED_OVERFLOW = 4

/** 버튼 칸 → 그림 프레임. 버튼이 하나면 알림이라 "OK" 한 장뿐이고 고른 그림이 따로 없다 */
function buttonFrameOf(count: number, index: number, isSelected: boolean): number | undefined {
  if (count <= 1) return NOTICE_FRAME
  return (isSelected ? YES_NO_SELECTED_FRAMES : YES_NO_FRAMES)[index]
}

export function MessageBox({ text, buttons, listItems, onAnswer }: MessageBoxProps) {
  const [selected, setSelected] = useState(0)

  // 상자가 열려 있는 동안 키는 상자 것이다. 뒤쪽 메뉴가 같은 Enter 를 같이 받으면
  // 상자를 눌러 닫을 수 없고 (상점 구매 확인), Escape 가 화면을 빠져나가 버린다 (관리 알림).
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer
  const isAnsweredRef = useRef(false)
  const isFinishedRef = useRef(false)

  const boxRef = useRef<HTMLDivElement>(null)
  /** 다 펼쳐졌을 때의 상자 높이. 레이아웃이 없으면 0 이라 애니메이션을 아예 안 한다 */
  const fullHeightRef = useRef(0)
  const [animation, setAnimation] = useState<BoxAnimation>(null)

  // 열림: 첫 그리기 전에 높이를 재고 10 에서 시작한다 (0x75006)
  useLayoutEffect(() => {
    const full = boxRef.current?.offsetHeight ?? 0
    fullHeightRef.current = full
    if (full > OPEN_START_HEIGHT) setAnimation({ kind: '열림', height: OPEN_START_HEIGHT })
  }, [])

  // 같은 자리에서 글만 바뀌면 **새 상자**다 (보상 안내가 잇달아 뜨는 화면들). 답 잠금을 푼다 —
  // 안 그러면 두 번째 상자의 [OK] 가 먹히지 않는다. (첫 글은 위 useLayoutEffect 가 이미 맡았다)
  const shownTextRef = useRef(text)
  useEffect(() => {
    if (shownTextRef.current === text) return
    shownTextRef.current = text
    isAnsweredRef.current = false
    isFinishedRef.current = false
    setAnimation(fullHeightRef.current > OPEN_START_HEIGHT ? { kind: '열림', height: OPEN_START_HEIGHT } : null)
  }, [text])

  const answer = useCallback((index: number) => {
    if (isAnsweredRef.current) return
    isAnsweredRef.current = true
    // 원본은 닫힘 애니메이션이 끝난 뒤에 콜백을 부른다 (0x755d8). 레이아웃이 없으면 곧바로.
    if (fullHeightRef.current <= 0) return onAnswerRef.current(index)
    setAnimation({ kind: '닫힘', width: CLOSE_START_WIDTH, answer: index })
  }, [])

  // 갱신 한 번 = 게임 루프 한 틱 (원본도 "매 갱신" 이다)
  const animationRef = useRef(animation)
  animationRef.current = animation
  const animationKind = animation?.kind ?? null
  useEffect(() => {
    if (animationKind === null) return
    const timer = window.setInterval(() => {
      const previous = animationRef.current
      if (previous === null || isFinishedRef.current) return
      if (previous.kind === '열림') {
        const next = previous.height * OPEN_GROWTH
        // 두 배가 목표 이상이면 목표 높이로 맞추고 애니메이션을 끝낸다
        return setAnimation(next >= fullHeightRef.current ? null : { kind: '열림', height: next })
      }
      const next = Math.floor(previous.width / CLOSE_SHRINK)
      setAnimation({ kind: '닫힘', width: next, answer: previous.answer })
      if (next > CLOSE_END_WIDTH) return
      isFinishedRef.current = true
      onAnswerRef.current(previous.answer)
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [animationKind])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 화면의 window 리스너(메뉴 목록·커맨드 줄·타석)까지 막는다
      event.stopImmediatePropagation()
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setSelected((previous) => (previous + step + buttons.length) % buttons.length)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return answer(selectedRef.current)
      }
      // 취소는 마지막 버튼 — 두 개면 [아니오], 하나면 [확인]
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        answer(buttons.length - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [answer, buttons.length])

  // 펼치는 동안에는 높이만, 닫는 동안에는 폭만 원본 값으로 눌러 그린다.
  // 세로 가운데는 CSS(top 50% + translateY(−50%))가 이미 맞춰 준다.
  const boxStyle =
    animation === null
      ? undefined
      : animation.kind === '열림'
        ? { height: animation.height, overflow: 'hidden' as const }
        : { left: Math.floor((CLOSE_START_WIDTH - animation.width) / 2), width: animation.width, overflow: 'hidden' as const }
  // 펼치는 동안은 글·버튼을 안 그린다 (0x7479c). 닫는 동안에는 원본도 그대로 그린다.
  const contentStyle = animation?.kind === '열림' ? { visibility: 'hidden' as const } : undefined

  return (
    <div className={styles.dim} role="dialog" aria-label="알림">
      <div className={styles.box} ref={boxRef} style={boxStyle}>
        <div className={styles.text} style={contentStyle}>
          <MarkupText raw={text} />
        </div>
        <div className={styles.buttons} style={contentStyle}>
          {buttons.map((label, index) => {
            const isSelected = index === selected
            // 글자 목록이면 그림을 쓰지 않는다 — 예/아니오 그림으로는 다른 것을 고를 수 없다
            const frame = listItems === undefined ? buttonFrameOf(buttons.length, index, isSelected) : undefined
            const shown = listItems?.[index] ?? label
            return (
              <button key={label} type="button" className={styles.button} aria-label={label}
                onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)}
                onClick={() => answer(index)}>
                {frame === undefined ? (isSelected ? `▶ ${shown}` : shown) : (
                  <img
                    className={styles.buttonImage}
                    src={`${POPUP}/${String(frame).padStart(3, '0')}.png`}
                    alt=""
                    // 선택 그림(49×23)은 원점이 (−4,−4) 라 같은 자리에서 사방 4px 넘쳐 그려진다
                    style={isSelected && buttons.length > 1 ? { left: -SELECTED_OVERFLOW, top: -SELECTED_OVERFLOW } : undefined}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
