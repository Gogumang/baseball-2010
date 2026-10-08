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
  /**
   * 처음 고른 칸 (안 주면 0 = 첫 칸 — 지금까지와 같다).
   *
   * 원본은 상자를 띄울 때마다 격자 객체를 새로 만들어(0x75070 `new(0x28)` → 0x6bd7c → 0x6bd38 이 +0xc/+0x10 을 0 으로)
   * 칸 배치 0x6bfe1 이 `vtbl+0x14(0, 0)`(0x6c00d) 로 커서를 (0, 0) 에 두고, 첫 버튼만 고름 표시를 켠다(0x7511a 인자 1).
   * 곧 **기본은 첫 칸**이다. 몇몇 자리는 띄운 바로 뒤 `0x749d5(창, n)` 을 불러 커서를 n 칸으로 옮긴다 —
   * 열 수 c 로 (n % c, n / c) 를 격자 +0xc/+0x10 에 넣고 모든 버튼 고름 표시를 끈 뒤 칸 n 만 켠다(0x749d4~0x74a4e).
   * 예/아니오(종류 2·3)는 버튼 1 "예" · 2 "아니오" 순서(0x750f8~0x75140)라 n = 1 이 **"아니오"** 다.
   */
  readonly initialSelected?: number
  /**
   * 버튼 그림을 자리가 직접 고른다 — 종류 0x10 창처럼 띄운 쪽이 `0x74ea9(창, 고른 그림, 보통 그림, 0)` 로 버튼을 하나씩 넣는 자리.
   * 값은 `ui/popup.pzx` 프레임 번호다 (예: 일반모드 [13] 이어하기 4/9 · 새로하기 3/8 · 빠른실행 5/10).
   * 안 주면 알림 0 · 예/아니오 1·2(고르면 6·7)다.
   */
  readonly buttonFrames?: readonly { readonly normal: number; readonly selected: number }[]
  /**
   * 버튼 격자 — 창 +0x218 격자의 열 수와 칸 사이 간격([+0x264] 가로 · [+0x268] 세로, 0x74805 가 바꾼다).
   * 안 주면 한 줄(열 수 = 버튼 수)에 기본 간격 40/10 (0x750a8~0x750be)이다.
   */
  readonly grid?: { readonly columns: number; readonly gapX: number; readonly gapY: number }
  /**
   * 취소 키(CLR)가 주는 답. 원본은 띄운 쪽이 창의 키 표([+0x234]/[+0x240], 0x75670~0x756b6)에 −16 → 값을 넣는다 —
   * 예: 일반모드 [13] 은 −1(0x29760~0x2977c). 안 주면 지금까지처럼 마지막 칸이다.
   */
  readonly cancelAnswer?: number
  /**
   * 뒤 어둡게의 검정 몫 (0x746cc 의 0x74704~0x7474a — 창이 떠 있는 그리기마다 [0x15605d0](0, 0, W, H, 검정, 단계 5) =
   * 검정 (5 + 1)/16, 장면이 세운 [창+0x24f] → [창+0x24e] 가 0 일 때). 안 주면 지금까지의 공용 근사다.
   */
  readonly dimOpacity?: number
  /** 누른 버튼 번호 */
  readonly onAnswer: (index: number) => void
  /**
   * 키를 받은 **그 갱신**의 답 — 닫힘 애니메이션(0x7558a~)을 기다리지 않는다. 띄운 쪽이 답 칸([창+0x21c])을 그 갱신에 읽는
   * 자리(예: 이벤트 보상의 기다림 0x8daa0)가 쓴다. `onAnswer` 는 그대로 다 닫힌 뒤에 온다.
   */
  readonly onAnswerKey?: (index: number) => void
}

/**
 * 메시지 상자 (0xbbef8 → 0x74ef4 배치 · 0x746cc 그리기 — layout-re 4차, 판·위치 바이트 확인).
 * 화면을 검정 반투명으로 덮고, 폭 240 띠를 세로 가운데에 둔다. 글은 (45, y+20) 부터 폭 150, 줄 간격 14.
 * 버튼은 `ui/popup.pzx` 프레임 그림이고 첫 버튼이 기본 선택이다 (F-1 확정 — 자리별 처음 칸은 `initialSelected`) — "확인" 이 아니라 **"OK"**,
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

/** 상자가 받는 키 — 펼치는 동안 · 닫히는 동안에도 기본 동작(스크롤 따위)은 막는다 */
const HANDLED_KEYS: ReadonlySet<string> = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape', 'Backspace'])

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

/**
 * 보통 그림의 크기 (`popup/frames/origins.json`) — 격자 칸 크기는 버튼 그림의 가장 큰 폭·높이다(0x74824).
 * 고른 그림(6~10 · 13·14)은 사방 4px 큰 같은 꼴이고 원점이 (−4,−4) 다.
 */
const NORMAL_FRAME_SIZES: Readonly<Record<number, { readonly width: number; readonly height: number }>> = {
  0: { width: 41, height: 15 }, 1: { width: 41, height: 15 }, 2: { width: 41, height: 15 },
  3: { width: 59, height: 15 }, 4: { width: 59, height: 15 }, 5: { width: 59, height: 15 },
  11: { width: 35, height: 53 }, 12: { width: 35, height: 53 },
}

/** 버튼 칸 → 그림 프레임. 버튼이 하나면 알림이라 "OK" 한 장뿐이고 고른 그림이 따로 없다 */
function buttonFrameOf(count: number, index: number, isSelected: boolean): number | undefined {
  if (count <= 1) return NOTICE_FRAME
  return (isSelected ? YES_NO_SELECTED_FRAMES : YES_NO_FRAMES)[index]
}

/**
 * 격자 커서 옮기기 — 격자 객체 키 0x6be70(−3 ←/−4 →/−1 ↑/−2 ↓) → 옮기기 vtbl+0xc 0x6bead.
 * 상자 격자는 모두 플래그 0x330(0x750f4 · 0x75414)이라 가로·세로 둘 다 **감기고**(0x10·0x20), 감기면 다른 축으로
 * 한 칸 **넘어간다**(0x100·0x200 — 다른 축 칸이 둘 이상이고 한 단계 깊이까지, 0x6bef2~0x6bf1c · 0x6bf70~).
 * 곧 한 줄 상자(예/아니오)는 ↑↓ 도 칸을 바꾸고, 한 열 상자(일반모드 [13])는 ←→ 도 칸을 바꾼다.
 */
function moveGridCursor(index: number, columns: number, count: number, dx: number, dy: number): number {
  const rows = Math.max(1, Math.ceil(count / columns))
  let x = index % columns
  let y = Math.floor(index / columns)
  const move = (stepX: number, stepY: number, depth: number) => {
    if (stepX !== 0) {
      const isWrapped = x + stepX < 0 || x + stepX >= columns
      x = (((x + stepX) % columns) + columns) % columns
      if (isWrapped && rows > 1 && depth <= 1) move(0, Math.sign(stepX), depth + 1)
    }
    if (stepY !== 0) {
      const isWrapped = y + stepY < 0 || y + stepY >= rows
      y = (((y + stepY) % rows) + rows) % rows
      if (isWrapped && columns > 1 && depth <= 1) move(Math.sign(stepY), 0, depth + 1)
    }
  }
  move(dx, dy, 1)
  return Math.min(y * columns + x, count - 1)
}

export function MessageBox({
  text, buttons, listItems, initialSelected = 0, buttonFrames, grid, cancelAnswer, dimOpacity, onAnswer, onAnswerKey,
}: MessageBoxProps) {
  /** 격자 열 수 — 안 주면 버튼이 한 줄이다 */
  const columns = Math.max(1, grid?.columns ?? buttons.length)
  const firstSelected = Math.min(Math.max(0, initialSelected), Math.max(0, buttons.length - 1))
  const [selected, setSelected] = useState(firstSelected)

  // 상자가 열려 있는 동안 키는 상자 것이다. 뒤쪽 메뉴가 같은 Enter 를 같이 받으면
  // 상자를 눌러 닫을 수 없고 (상점 구매 확인), Escape 가 화면을 빠져나가 버린다 (관리 알림).
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const onAnswerRef = useRef(onAnswer)
  onAnswerRef.current = onAnswer
  const onAnswerKeyRef = useRef(onAnswerKey)
  onAnswerKeyRef.current = onAnswerKey
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
  // 커서도 새 상자의 처음 칸으로 돌린다 — 원본은 상자를 띄울 때마다 격자를 새로 만들어(0x75070 `new(0x28)`)
  // 0x6bd38 이 +0xc/+0x10 을 0 으로, 칸 배치 0x6bfe1 이 `vtbl+0x14(0, 0)`(0x6c00d) 로 (0, 0) 에 둔다.
  // 그 자리가 띄운 뒤 `0x749d5(창, n)` 을 부르면 n 칸 — 곧 `initialSelected` 다. 앞 상자의 커서는 남지 않는다.
  const shownTextRef = useRef(text)
  useEffect(() => {
    if (shownTextRef.current === text) return
    shownTextRef.current = text
    isAnsweredRef.current = false
    isFinishedRef.current = false
    setSelected(firstSelected)
    setAnimation(fullHeightRef.current > OPEN_START_HEIGHT ? { kind: '열림', height: OPEN_START_HEIGHT } : null)
    // 새 상자는 글이 바뀔 때만 생긴다 — 같은 글에서 처음 칸 값만 바뀌어도 커서를 옮기지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const answer = useCallback((index: number) => {
    if (isAnsweredRef.current) return
    isAnsweredRef.current = true
    onAnswerKeyRef.current?.(index)
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
      // 다음 틱 · 키는 그리기를 기다리지 않고 이 값을 본다 — 틱 여럿이 한 그리기에 묶여도 한 틱씩 나아간다
      const advance = (next: BoxAnimation) => {
        animationRef.current = next
        setAnimation(next)
      }
      if (previous.kind === '열림') {
        const next = previous.height * OPEN_GROWTH
        // 두 배가 목표 이상이면 목표 높이로 맞추고 애니메이션을 끝낸다
        return advance(next >= fullHeightRef.current ? null : { kind: '열림', height: next })
      }
      const next = Math.floor(previous.width / CLOSE_SHRINK)
      advance({ kind: '닫힘', width: next, answer: previous.answer })
      if (next > CLOSE_END_WIDTH) return
      isFinishedRef.current = true
      onAnswerRef.current(previous.answer)
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [animationKind])

  /**
   * **키는 창이 떠 있는 동안 늘 창 것이다 — 펼치는 동안 · 닫히는 동안에도** (0x754f8, 직접 떴다).
   * 장면은 틀마다 먼저 0x754f9(창, 키)를 부르고 참이면 자기 키 처리를 건너뛴다(예: 나리 0x1d070 → 0x1d07c · 시즌 0xec70).
   * 0x754f8 은 [창+9] ≠ 0(떠 있음)이면 늘 1 을 돌려준다(0x756e4). 그 안에서 펼침([+0x214], 0x75556~0x75588)과
   * 닫힘([+0x215], 0x7558a~0x755d8 — 다 닫힌 틀도 0x742a8 로 [창+9] = 0 을 하고 1)은 키를 **보지 않고** 돌아가고,
   * 격자 · OK(−5 · '5' → 답 [+0x21c] · 닫힘 시작) · 키 표(CLR)는 둘 다 아닐 때만 돈다(0x755da~).
   * 그래서 웹도 이 상자가 그려져 있는 동안(닫히는 중 포함 — 이벤트 보상 창은 답한 뒤에도 다 닫힐 때까지 남는다) 키를 잡아
   * 뒤 화면에 안 넘기고, 펼치는 동안 · 답한 뒤에는 커서도 답도 움직이지 않는다.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 화면의 window 리스너(메뉴 목록·커맨드 줄·타석)까지 막는다
      event.stopImmediatePropagation()
      // 펼치는 동안 · 닫히는 동안(답한 뒤)은 키를 보지 않는다 — 0x75556 · 0x7558a 갈래
      if (animationRef.current !== null || isAnsweredRef.current) {
        if (HANDLED_KEYS.has(event.key)) event.preventDefault()
        return
      }
      const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (dx !== 0 || dy !== 0) {
        event.preventDefault()
        return setSelected((previous) => moveGridCursor(previous, columns, buttons.length, dx, dy))
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return answer(selectedRef.current)
      }
      // 취소는 띄운 쪽이 정한 값, 안 정했으면 마지막 버튼 — 두 개면 [아니오], 하나면 [확인]
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        answer(cancelAnswer ?? buttons.length - 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [answer, buttons.length, columns, cancelAnswer])

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

  // 격자 칸 크기 = 버튼 그림의 가장 큰 폭·높이(0x74824 의 0x7484e~0x74888) — 그림을 고른 자리만 다르다
  const cellSize = buttonFrames === undefined || listItems !== undefined
    ? null
    : buttonFrames.reduce(
      (size, pictures) => ({
        width: Math.max(size.width, NORMAL_FRAME_SIZES[pictures.normal]?.width ?? 0),
        height: Math.max(size.height, NORMAL_FRAME_SIZES[pictures.normal]?.height ?? 0),
      }),
      { width: 0, height: 0 },
    )
  // 격자를 준 자리만 칸을 열·줄로 놓는다 — 간격은 [+0x264] 가로 · [+0x268] 세로, 가운데 맞춤(0x74824)
  const gridStyle = grid === undefined ? undefined : {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, auto)`,
    columnGap: `${grid.gapX}px`,
    rowGap: `${grid.gapY}px`,
    justifyContent: 'center',
  }

  return (
    <div className={styles.dim} role="dialog" aria-label="알림"
      style={dimOpacity === undefined ? undefined : { background: `rgba(0, 0, 0, ${dimOpacity})` }}>
      <div className={styles.box} ref={boxRef} style={boxStyle}>
        <div className={styles.text} style={contentStyle}>
          <MarkupText raw={text} />
        </div>
        <div className={styles.buttons} style={{ ...gridStyle, ...contentStyle }}>
          {buttons.map((label, index) => {
            const isSelected = index === selected
            const pictures = buttonFrames?.[index]
            // 글자 목록이면 그림을 쓰지 않는다 — 예/아니오 그림으로는 다른 것을 고를 수 없다
            const frame = listItems !== undefined
              ? undefined
              : pictures !== undefined
                ? (isSelected ? pictures.selected : pictures.normal)
                : buttonFrameOf(buttons.length, index, isSelected)
            const shown = listItems?.[index] ?? label
            return (
              <button key={label} type="button" className={styles.button} aria-label={label}
                style={cellSize === null ? undefined : { width: cellSize.width, height: cellSize.height }}
                onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)}
                onClick={() => answer(index)}>
                {frame === undefined ? (isSelected ? `▶ ${shown}` : shown) : (
                  <img
                    className={styles.buttonImage}
                    src={`${POPUP}/${String(frame).padStart(3, '0')}.png`}
                    alt=""
                    // 선택 그림(49×23 · 67×23 · 43×57)은 원점이 (−4,−4) 라 같은 자리에서 사방 4px 넘쳐 그려진다
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
