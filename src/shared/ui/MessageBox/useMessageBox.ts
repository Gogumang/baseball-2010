import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { useMarksCommonWindowShown, useSceneClosesWithoutShrink } from '@/shared/lib/commonWindow/commonWindow'
import { messageBoxKeyActionOf, moveGridCursor, swallowHandledKey } from '@/shared/ui/MessageBox/messageBoxKeys'
import {
  CLOSE_END_WIDTH,
  CLOSE_SHRINK,
  CLOSE_START_WIDTH,
  OPEN_GROWTH,
  OPEN_START_HEIGHT,
  type BoxAnimation,
} from '@/shared/ui/MessageBox/messageBoxMotion'
import type { MessageBoxProps } from '@/shared/ui/MessageBox/messageBoxProps'

type MessageBoxStateProps = Pick<MessageBoxProps, 'text' | 'buttons' | 'grid' | 'cancelAnswer' | 'onAnswer' | 'onAnswerKey' | 'onRawKey'> & {
  readonly initialSelected: number
  readonly closesWithoutShrinkProp: boolean | undefined
  readonly opensOneStepIn: boolean
}

/**
 * 메시지 상자의 칸 · 키 · 애니메이션 — 커서 · 답 잠금 · 펼침/닫힘 틱 · 창 표지(`useMarksCommonWindowShown`). 그리는 쪽(`MessageBox`)은
 * 돌려준 값으로 판 · 글 · 버튼만 놓는다.
 */
export function useMessageBox({
  text,
  buttons,
  grid,
  cancelAnswer,
  onAnswer,
  onAnswerKey,
  onRawKey,
  initialSelected,
  closesWithoutShrinkProp,
  opensOneStepIn,
}: MessageBoxStateProps) {
  const onRawKeyRef = useRef(onRawKey)
  useMirrorRef(onRawKeyRef, onRawKey)
  // 창을 띄울 때 [창+0x24f] 를 [창+0x24e] 로 옮긴다(0x7503c) — 띄운 자리가 정하지 않았으면 지금 장면의 값
  const sceneClosesWithoutShrink = useSceneClosesWithoutShrink()
  const closesWithoutShrink = closesWithoutShrinkProp ?? sceneClosesWithoutShrink
  /** 격자 열 수 — 안 주면 버튼이 한 줄이다 */
  const columns = Math.max(1, grid?.columns ?? buttons.length)
  const firstSelected = Math.min(Math.max(0, initialSelected), Math.max(0, buttons.length - 1))
  const [selected, setSelected] = useState(firstSelected)

  // 상자가 열려 있는 동안 키는 상자 것이다. 뒤쪽 메뉴가 같은 Enter 를 같이 받으면
  // 상자를 눌러 닫을 수 없고 (상점 구매 확인), Escape 가 화면을 빠져나가 버린다 (관리 알림).
  const selectedRef = useRef(selected)
  useMirrorRef(selectedRef, selected)
  const onAnswerRef = useRef(onAnswer)
  useMirrorRef(onAnswerRef, onAnswer)
  const onAnswerKeyRef = useRef(onAnswerKey)
  useMirrorRef(onAnswerKeyRef, onAnswerKey)
  const isAnsweredRef = useRef(false)
  const closesWithoutShrinkRef = useRef(closesWithoutShrink)
  useMirrorRef(closesWithoutShrinkRef, closesWithoutShrink)
  const isFinishedRef = useRef(false)
  /**
   * 창이 치워졌다 — [창+9] = 0 (닫힘 0x7558a~ 이 폭 99 이하에서 0x742a8). 그 전까지(펼침 · 닫힘 포함) 공용 창이 떠 있다고 센다
   * (`isCommonWindowShown` — 경기 장면 0x52c50 의 파티클 게이트 53048)
   */
  const [isGone, setIsGone] = useState(false)
  useMarksCommonWindowShown(!isGone)

  const boxRef = useRef<HTMLDivElement>(null)
  /** 다 펼쳐졌을 때의 상자 높이. 레이아웃이 없으면 0 이라 애니메이션을 아예 안 한다 */
  const fullHeightRef = useRef(0)
  const [animation, setAnimation] = useState<BoxAnimation>(null)

  // 열림: 첫 그리기 전에 높이를 재고 10 에서 시작한다 (0x75006). `opensOneStepIn` 이면 띄운 갱신이 한 번 두 배로 한 뒤라
  // 첫 그림이 20 — 목표 < 20 이면 그 갱신에 다 펼친다(0x7557c)
  const opensOneStepInAtMount = useRef(opensOneStepIn)
  useLayoutEffect(() => {
    const full = boxRef.current?.offsetHeight ?? 0
    fullHeightRef.current = full
    const start = opensOneStepInAtMount.current ? OPEN_START_HEIGHT * OPEN_GROWTH : OPEN_START_HEIGHT
    if (full > OPEN_START_HEIGHT && start <= full) setAnimation({ kind: '열림', height: start })
    // 처음 한 번만 — 펼침 시작은 띄운 그 갱신이 정한다
  }, [])

  // 같은 자리에서 글만 바뀌면 **새 상자**다 (보상 안내가 잇달아 뜨는 화면들). 답 잠금을 푼다 —
  // 안 그러면 두 번째 상자의 [OK] 가 먹히지 않는다. (첫 글은 위 useLayoutEffect 가 이미 맡았다)
  // 커서도 새 상자의 처음 칸으로 돌린다 — 원본은 상자를 띄울 때마다 격자를 새로 만들어(0x75070 `new(0x28)`)
  // 0x6bd38 이 +0xc/+0x10 을 0 으로, 칸 배치 0x6bfe1 이 `vtbl+0x14(0, 0)`(0x6c00d) 로 (0, 0) 에 둔다.
  // 그 자리가 띄운 뒤 `0x749d5(창, n)` 을 부르면 n 칸 — 곧 `initialSelected` 다. 앞 상자의 커서는 남지 않는다.
  const shownTextRef = useRef(text)
  // 글이 바뀐 그림의 처음 칸 — 아래 effect 는 글이 바뀔 때만 돈다
  const firstSelectedRef = useRef(firstSelected)
  useMirrorRef(firstSelectedRef, firstSelected)
  useEffect(() => {
    if (shownTextRef.current === text) return
    shownTextRef.current = text
    isAnsweredRef.current = false
    isFinishedRef.current = false
    setIsGone(false)
    setSelected(firstSelectedRef.current)
    setAnimation(fullHeightRef.current > OPEN_START_HEIGHT ? { kind: '열림', height: OPEN_START_HEIGHT } : null)
    // 새 상자는 글이 바뀔 때만 생긴다 — 같은 글에서 처음 칸 값만 바뀌어도 커서를 옮기지 않는다
  }, [text])

  const answer = useCallback((index: number) => {
    if (isAnsweredRef.current) return
    isAnsweredRef.current = true
    onAnswerKeyRef.current?.(index)
    // 원본은 닫힘 애니메이션이 끝난 뒤에 콜백을 부른다 (0x755d8). 레이아웃이 없으면 곧바로.
    if (fullHeightRef.current <= 0) {
      setIsGone(true)
      return onAnswerRef.current(index)
    }
    setAnimation({ kind: '닫힘', width: closesWithoutShrinkRef.current ? 0 : CLOSE_START_WIDTH, answer: index })
  }, [])

  // 갱신 한 번 = 게임 루프 한 틱 (원본도 "매 갱신" 이다)
  const animationRef = useRef(animation)
  useMirrorRef(animationRef, animation)
  const animationKind = animation?.kind ?? null
  useEffect(() => {
    if (animationKind === null) return
    const timer = setAppTickInterval(() => {
      const previous = animationRef.current
      if (previous === null || isFinishedRef.current) return
      // 다음 틱 · 키는 그리기를 기다리지 않고 이 값을 본다 — 틱 여럿이 한 그리기에 묶여도 한 틱씩 나아간다
      const advance = (next: BoxAnimation) => {
        animationRef.current = next
        setAnimation(next)
      }
      if (previous.kind === '열림') {
        const next = previous.height * OPEN_GROWTH
        // 목표 < 두 배면 목표 높이로 맞추고 애니메이션을 끝낸다 — 같으면 한 갱신 더 펼침이다(0x7557c `blt`)
        return advance(next > fullHeightRef.current ? null : { kind: '열림', height: next })
      }
      const next = Math.floor(previous.width / CLOSE_SHRINK)
      advance({ kind: '닫힘', width: next, answer: previous.answer })
      if (next > CLOSE_END_WIDTH) return
      isFinishedRef.current = true
      setIsGone(true)
      onAnswerRef.current(previous.answer)
    })
    return () => timer()
  }, [animationKind])

  /**
   * **키는 창이 떠 있는 동안 늘 창 것이다 — 펼치는 동안 · 닫히는 동안에도** (0x754f8, 직접 떴다).
   * 장면은 틀마다 먼저 0x754f9(창, 키)를 부르고 참이면 자기 키 처리를 건너뛴다(예: 나리 0x1d070 → 0x1d07c · 시즌 0xec70).
   * 0x754f8 은 [창+9] ≠ 0(떠 있음)이면 늘 1 을 돌려준다(0x756e4). 그 안에서 펼침([+0x214], 0x75556~0x75588)과
   * 닫힘([+0x215], 0x7558a~0x755d8 — 다 닫힌 틀도 0x742a8 로 [창+9] = 0 을 하고 1)은 키를 **보지 않고** 돌아가고,
   * 격자 · OK(−5 · '5' → 답 [+0x21c] · 닫힘 시작) · 키 표(CLR)는 둘 다 아닐 때만 돈다(0x755da~).
   * 그래서 웹도 이 상자가 그려져 있는 동안(닫히는 중 포함 — 이벤트 보상 창은 답한 뒤에도 다 닫힐 때까지 남는다) 키를 잡아
   * 뒤 화면에 안 넘기고, 펼치는 동안 · 답한 뒤에는 커서도 답도 움직이지 않는다.
   *
   * **창 키도 받은 다음 틀이다** (r172 직접 떴다): 장면 다섯(0xe9ac · 0x1cdec · 0x1eb0c · 0x32fa0 · 0x52c50) 모두 틀 머리 0xbca05 가
   * 받은 칸을 이번 틀 누름 [장면+0x40] 으로 옮긴 뒤 그 값을 0x754f9 에 넘긴다(ec6c · 1d06c · 52cc2 `ldr r1, [장면+0x40]`). 그래서
   * 이 듣는 곳이 받는 사건은 앱 키 문(`appKeyGate`)이 다음 앱 틱 머리에 다시 쏜 것이고(틱마다 마지막 누름 하나), 누른 채
   * 되풀이는 오지 않는다(되풀이 [+0x38] 은 창이 안 본다).
   */
  useEffect(() => {
    const isBusy = () => animationRef.current !== null || isAnsweredRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 화면의 window 리스너(메뉴 목록·커맨드 줄·타석)까지 막는다
      event.stopImmediatePropagation()
      onRawKeyRef.current?.(event.key)
      // 펼치는 동안 · 닫히는 동안(답한 뒤)은 키를 보지 않는다 — 0x75556 · 0x7558a 갈래
      if (isBusy()) return swallowHandledKey(event)
      // 창 격자는 0x753f4 가 vt+0x10(격자, 열, 줄, **1**, 0x330, 0)으로 짓는다 — 셋째 인자 1 은 숫자키 꼴 1(표 0xd2e7c)이라
      // '2' '4' '6' '8' 도 ↑ ← → ↓ 로 바뀌어 격자를 옮긴다(미션 고르기 격자 vt+0x1c(5, 3, 1, 0x330)와 같은 꼴, r333)
      const action = messageBoxKeyActionOf(event.key)
      if (action === null) return
      event.preventDefault()
      if (action.kind === '옮김') return setSelected((previous) => moveGridCursor(previous, columns, buttons.length, action.dx, action.dy))
      // OK 는 날 키로 견준다 — 75634~7563e (r333 — 예전 웹은 '5' 를 버렸다)
      if (action.kind === '확인') return answer(selectedRef.current)
      // 취소는 띄운 쪽이 정한 값, 안 정했으면 마지막 버튼 — 두 개면 [아니오], 하나면 [확인]
      answer(cancelAnswer ?? buttons.length - 1)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [answer, buttons.length, columns, cancelAnswer])

  return { boxRef, selected, setSelected, answer, animation, columns }
}
