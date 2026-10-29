import { useEffect } from 'react'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import type { AnnalsDirection } from '@/pages/special/ui/specialScreen/otherSlices'

/**
 * 말풍선 갈래 2ac76 은 날 키로 가른다 — −1 · '2'(2aca8) → 2aea6 커서 −1 · −2 · '8'(2acb0) → 2aeb6 커서 +1(두 칸이라 감김),
 * −5 · '5'(2aca0) → 2acb8 확인, −16 → 2aeca 닫기. ← → '4' '6' 은 아무 일 없음 (r333 — 예전 웹은 숫자키를 버렸다)
 */
const BUBBLE_TOGGLE_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', '2', '8'])
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
const BACK_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/**
 * 메인 메뉴 16 · 17 · 27 · 나리 145 · 시즌 0xe2: 키 0x62568 이 격자 [목록+0x134] 의 vt+0x18(0x6c299 → 0x6c521 → 0x6c031,
 * 숫자키 꼴 1)에 넘긴다 — '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK
 */
const GRID_DIRECTION_BY_KEY: ReadonlyMap<string, AnnalsDirection> = new Map([
  ['ArrowRight', 'right'],
  ['6', 'right'],
  ['ArrowLeft', 'left'],
  ['4', 'left'],
  ['ArrowDown', 'down'],
  ['8', 'down'],
  ['ArrowUp', 'up'],
  ['2', 'up'],
])

interface HallOfFameKeysInput {
  /** 안내 · 팝업이 없다 */
  readonly isActive: boolean
  /** 열림 애니가 도는 동안 키를 버린다 */
  readonly keyLock: { readonly current: boolean }
  readonly isBubbleOpen: boolean
  readonly bubble: { readonly onToggle: () => void; readonly onConfirm: () => void; readonly onClose: () => void }
  readonly onMove: (direction: AnnalsDirection) => void
  readonly onPress: () => void
  readonly onBack: () => void
}

/** 말풍선 키 — 위 · 아래는 두 칸을 오가고 확인 · 닫기 */
function handleBubbleKey(event: KeyboardEvent, bubble: HallOfFameKeysInput['bubble']): void {
  if (BUBBLE_TOGGLE_KEYS.has(event.key)) {
    event.preventDefault()
    return bubble.onToggle()
  }
  if (CONFIRM_KEYS.has(event.key)) {
    event.preventDefault()
    return bubble.onConfirm()
  }
  if (BACK_KEYS.has(event.key)) {
    event.preventDefault()
    bubble.onClose()
  }
}

/** 격자 키 — 방향 · 확인 · 되돌아가기 */
function handleGridKey(event: KeyboardEvent, { onMove, onPress, onBack }: HallOfFameKeysInput): void {
  const direction = GRID_DIRECTION_BY_KEY.get(event.key) ?? null
  if (direction !== null) {
    // 창이 없으면 격자가 바꾼 키를 0x5550c 에 넘긴다(0x62568 625a0~625be) — 숫자키도 방향으로 [skin+0x8c] 에 남는다(Q-10).
    // 말풍선(0x2ac00 [skin+0x126] ≠ 0 → 2ac76)은 목록을 안 불러 여기 오지 않는다
    noteSkinShakeDirection(direction)
    event.preventDefault()
    return onMove(direction)
  }
  if (CONFIRM_KEYS.has(event.key)) {
    event.preventDefault()
    return onPress()
  }
  if (BACK_KEYS.has(event.key)) {
    event.preventDefault()
    onBack()
  }
}

/** 명예의 전당 키 — 잡기 단계에서 받아 다른 듣는 이에게 안 넘긴다. effect 는 옛처럼 의존성 없이 그림마다 다시 건다 */
export function useHallOfFameKeys(input: HallOfFameKeysInput) {
  useEffect(() => {
    if (!input.isActive) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (input.keyLock.current) return
      if (input.isBubbleOpen) return handleBubbleKey(event, input.bubble)
      handleGridKey(event, input)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })
}
