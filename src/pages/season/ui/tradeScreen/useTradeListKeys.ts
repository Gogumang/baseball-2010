import { useEffect } from 'react'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import { isListStep } from './tradeTexts'
import type { TradeState } from './useTradeState'

interface TradeListKeysInput {
  readonly state: TradeState
  readonly isRequest: boolean
  readonly isBusy: boolean
  readonly rowCount: number
  readonly cursor: number
  /** 요청 중에는 커서가 묶여 아무 일도 안 한다 */
  readonly moveCursor: (index: number) => void
  readonly moveTo: (index: number) => void
}

/** 한 칸 감아 옮긴 커서 — 칸이 없으면 null */
export const wrappedCursorOf = (cursor: number, step: number, count: number) => (count > 0 ? (cursor + step + count) % count : null)

/** 키 하나를 받는 window keydown 처리기를 건다 — 렌더마다 다시 건다(옛 등록 차례 그대로) */
function useKeyEveryRender(isOn: boolean, onKey: (event: KeyboardEvent) => void) {
  useEffect(() => {
    if (!isOn) return undefined
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}

/**
 * 0xe5 · 0xe6 목록 창 키 — '2' '8' 커서 · '*' 목록 탭 · '0' 상세 창 · 키 셈. 등록 차례는 옛 그대로(셋은 렌더마다, 키 셈은 켬이 바뀔 때).
 *
 * 0xe5 · 0xe6 목록 [ed+0x41c] 은 0x55724 가 0x6c219 vt+0x1c(1열, n줄, 숫자키 꼴 **1**, 꼴 0x20) 으로 짓고(r263 직접 뜸),
 * 편집기 키 0x55864 가 키를 그대로 넘긴다(0x5588e~0x5589a) — 격자 키 0x6c030 이 '2' '8' 을 ↑ ↓ 로 바꿔 커서를 감아 옮긴다.
 * '4' '6' · ← → 는 1열 · 꼴 0x20(0x10 · 0x100 없음)이라 안 움직인다. 요청 중에는 0x7104 · 0x727c 가 '2' '8' 도 −3 으로 바꿔 막는다
 */
export function useTradeListKeys({ state, isRequest, isBusy, rowCount, cursor, moveCursor, moveTo }: TradeListKeysInput) {
  const { step, setKeyPresses } = state
  const isListOpen = isListStep(step) && !isBusy

  useKeyEveryRender(isListOpen, (event) => {
    if (event.key !== '2' && event.key !== '8') return
    event.preventDefault()
    const next = wrappedCursorOf(cursor, event.key === '2' ? -1 : 1, rowCount)
    if (next !== null) moveCursor(next)
  })

  /** '*' (편집기 559b2) — 목록 탭만 뒤집고 커서 0. 트레이드 탭(this+0x154)은 0xe5 OK 에서만 바뀐다 */
  const flipListTab = () => {
    state.setListTab((current) => (current === TRADE_REQUEST_TAB.투수 ? TRADE_REQUEST_TAB.타자 : TRADE_REQUEST_TAB.투수))
    moveTo(0)
  }
  // '*' 는 0xe5(요청 아님)만 편집기에 간다 — 0xe6 키 0x727c 는 늘 거른다 (tradeTexts 머리 주석)
  const canFlip = !isRequest && step.kind === '영입' && !isBusy
  useKeyEveryRender(canFlip, (event) => {
    if (event.key !== '*') return
    event.preventDefault()
    flipListTab()
  })

  // 키 셈 — 목록 창 단계(0xe5 · 0xe6)에서 키가 들어올 때마다 (팝업이 키를 먹는 동안은 편집기에 안 간다)
  /** '0' — 편집기 55920 이 [ed+0x424] 를 뒤집는다 (0x7104 · 0x727c 가 거르지 않는 키) */
  const toggleDetail = () => state.setDetailOpenedAt((opened) => (opened === step ? null : step))
  useKeyEveryRender(isListOpen, (event) => {
    if (event.key !== '0') return
    event.preventDefault()
    toggleDetail()
  })
  useEffect(() => {
    if (!isListOpen) return undefined
    const onKeyDown = () => setKeyPresses((count) => count + 1)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isListOpen, setKeyPresses])

  return { isListOpen, canFlip, flipListTab, toggleDetail }
}
