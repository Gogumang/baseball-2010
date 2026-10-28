import { useEffect, useRef, useState } from 'react'

/**
 * 시즌 화면의 커서 — 원본 키 규칙 그대로 (P4 1a).
 *
 * ```
 * 키 값: −5 · 0x35('5') = 확인 ,  −16 = 취소/뒤로   (0x8f30 · 0x48d0 · 0x4e40 공통)
 * ```
 * 웹에서는 Enter·Space·`5` 를 확인으로, Escape·Backspace 를 취소로 받는다.
 * 화살표는 원본 메뉴 객체(`0x6c219`)의 커서 이동이다. 커맨드 줄 하위 메뉴(`isCommandBar`)는 n열 × 1줄이라 ← → 도 받는다.
 */
export interface SeasonCursorOptions {
  /** 칸 수. 0 이면 커서가 움직이지 않는다 */
  readonly count: number
  readonly onSelect: (index: number) => void
  readonly onCancel?: () => void
  /**
   * 거짓이면 화면은 키를 안 받는다 — 팝업(장면 틀 0xe9ac 의 창 게이트 0x754f9) · 관리 메뉴 0xc9 칸 펼침(`[this+0xc0]+0x99`, A-50)
   */
  readonly isEnabled?: boolean
  /**
   * 커서를 부르는 쪽이 들고 있으면 넘긴다 — 원본 메뉴 객체(관리 메뉴 this+0x70 · 구단관리 this+0x78)는 장면이 사는 동안
   * 남아 상태를 오가도 커서가 이어진다. 주면 `onCursorChange` 로만 바뀐다.
   */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
  /**
   * 메뉴 켬 표(메뉴 +0x28)가 0 인 칸 — 위·아래 이동 0x6c444 가 건너뛴다(직접 떴다):
   * ```
   * n = 켠 칸 수 (0x6c3f4)
   * 지금 칸이 켜져 있으면 n > 1, 꺼져 있으면 n > 0 일 때만 움직인다 — 아니면 제자리
   * 한 칸씩 옮기기(0x6be70)를 켠 칸에 닿을 때까지 되풀이 — 옮겨도 자리가 그대로면(끝에서 막힘) 처음 자리로 돌린다
   * ```
   * 확인 키는 이 표를 안 본다(0x8f30 · 0x4e40) — 막는 것은 이동뿐이다.
   */
  readonly disabled?: readonly number[]
  /**
   * **커맨드 줄 하위 메뉴**(n열 × 1줄 · 숫자키 꼴 1 · 꼴 0x330) — ← → 와 '4' '6' · '2' '8' 도 받는다.
   * 시즌 장면 생성 0x3b14 가 관리 메뉴 +0x70 · 시즌정보 +0x74 · 구단관리 +0x78 · 트레이닝 +0x84 · 아이템 +0x88 을 모두
   * `vt+0x1c(n, 1, 1, 0x330)`(0x6bfe1: 첫 인자 → +0x14 **열**, 둘째 → +0x18 줄)로 짓는다(직접 떴다, 0x3b74~0x3c50).
   * 키 0x8f30 등은 OK · CLR 밖의 키를 격자 vt+0x18 로 그대로 넘기고, 격자 키 0x6c030 이 '2' '4' '6' '8' 을 ↑ ← → ↓ 로 바꾼 뒤
   * −1 ~ −4 를 옮기기 vt+0x8(0x6c445, 꺼진 칸 건너뛰기) → 0x6be71(−3 ← dx −1 · −4 → dx +1 · −1 ↑ dy −1 · −2 ↓ dy +1) → 0x6bead:
   * ```
   * ← →  꼴 0x10 — x = (x ± 1) mod n                    ; 0x100(세로 한 칸)은 줄 > 1 이 아니라 안 걸린다
   * ↑ ↓  꼴 0x20 — 1줄이라 감기고, 0x200 · 열 > 1 이면 가로로 같은 부호 한 칸(되부름 깊이 1)
   * ```
   * 곧 ↑ = ←, ↓ = → 이다. 거짓이면 ↑ ↓ 만 받는다(다른 꼴의 화면).
   */
  readonly isCommandBar?: boolean
}

/** ↑ ↓ 만 받는 화면 */
const PLAIN_STEPS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 }
/** 커맨드 줄 하위 메뉴 (n × 1 · 꼴 0x330 · 숫자키 꼴 1) — ↑ ← '2' '4' 는 −1, ↓ → '8' '6' 은 +1 */
const COMMAND_BAR_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  '2': -1,
  '4': -1,
  ArrowDown: 1,
  ArrowRight: 1,
  '8': 1,
  '6': 1,
}

export interface SeasonCursor {
  readonly cursor: number
  readonly moveTo: (index: number) => void
}

export function useSeasonCursor({
  count,
  onSelect,
  onCancel,
  isEnabled = true,
  cursor: heldCursor,
  onCursorChange,
  disabled = [],
  isCommandBar = false,
}: SeasonCursorOptions): SeasonCursor {
  const [ownCursor, setOwnCursor] = useState(0)
  const cursor = heldCursor ?? ownCursor

  // 칸이 줄어들면 커서를 안으로 끌어온다 — 목록이 바뀌는 화면(영입 목록)이 있다
  const safeCursor = count === 0 ? 0 : Math.min(cursor, count - 1)

  const setCursor = (index: number) => {
    if (heldCursor === undefined) setOwnCursor(index)
    onCursorChange?.(index)
  }
  /** 위·아래 한 칸 — 화면이 커서를 들면 이전 값에서 셈하고, 부르는 쪽이 들면 지금 값에서 셈해 넘긴다 */
  const stepCursor = (step: number, total: number, current: number) => {
    const isOn = (index: number) => !disabled.includes(index)
    const next = (previous: number) => {
      const start = Math.min(previous, total - 1)
      // 0x6c444 — 켠 칸이 지금 칸 말고 없으면 제자리
      let onCount = 0
      for (let index = 0; index < total; index += 1) if (isOn(index)) onCount += 1
      if (onCount <= (isOn(start) ? 1 : 0)) return start
      let position = start
      do position = (position + step + total) % total
      while (!isOn(position))
      return position
    }
    if (heldCursor === undefined) return setOwnCursor(next)
    onCursorChange?.(next(current))
  }

  const latest = useRef({ count, onSelect, onCancel, cursor: safeCursor, stepCursor })
  latest.current = { count, onSelect, onCancel, cursor: safeCursor, stepCursor }

  useEffect(() => {
    if (!isEnabled) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const { count: total, cursor: current, onSelect: select, onCancel: cancel, stepCursor: move } = latest.current
      const step = isCommandBar ? COMMAND_BAR_STEPS[event.key] : PLAIN_STEPS[event.key]
      if (step !== undefined) {
        if (total === 0) return
        event.preventDefault()
        move(step, total, current)
        return
      }
      // 확인 — 원본 −5 · '5'
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        if (total === 0) return
        event.preventDefault()
        select(current)
        return
      }
      // 취소 — 원본 −16
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (cancel === undefined) return
        event.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isEnabled, isCommandBar])

  return { cursor: safeCursor, moveTo: setCursor }
}
