import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { MISSION_GRID_SHAPE } from '@/pages/mission-select/lib/missionSelectLayout'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import { moveGridCursor } from './otherSlices'

type GridDirection = 'left' | 'right' | 'up' | 'down'

/** 숫자키 꼴 1 (표 0xd2e7c): '2' ↑ · '4' ← · '6' → · '8' ↓ */
const GRID_DIRECTIONS = new Map<string, GridDirection>([
  ['ArrowRight', 'right'],
  ['6', 'right'],
  ['ArrowLeft', 'left'],
  ['4', 'left'],
  ['ArrowDown', 'down'],
  ['8', 'down'],
  ['ArrowUp', 'up'],
  ['2', 'up'],
])
const OK_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])
const BACK_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/** 창 · 팝업이 떠 있거나 이벤트 미션 창 답을 아직 안 넘겼으면 목록 키를 안 받는다 */
export function isMissionListBlocked(eventWindow: unknown, popup: unknown, eventKeyAnswer: unknown) {
  return eventWindow !== null || popup !== null || eventKeyAnswer !== null
}

/**
 * 키 0x1daa4 하위 0 — 격자 `vt+0x18`(0x6c031 — 숫자키 꼴 1) 이 커서를 옮기고 돌려준 키로 OK(−5 · '5') → 칸 고르기(`pressOk`),
 * CLR(−16) → 메인 메뉴(`onBack`). 창 · 팝업이 떠 있으면(`isBlocked`) 키를 안 받는다. 그림마다 지금 화면으로 다시 건다
 */
export function useMissionSelectKeys(
  isBlocked: boolean,
  cursor: number,
  setCursor: Dispatch<SetStateAction<number>>,
  bounceStart: (direction: GridDirection) => void,
  pressOk: (index: number) => void,
  onBack: () => void,
) {
  useEffect(() => {
    if (isBlocked) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = GRID_DIRECTIONS.get(event.key) ?? null
      if (direction !== null) {
        event.preventDefault()
        // 키 0x1daa4 머리(1dacc)가 격자가 바꾼 키를 0x5550d 에 넘긴다 — [skin+0x8c] 에 남는다(Q-10)
        noteSkinShakeDirection(direction)
        const next = moveGridCursor(MISSION_GRID_SHAPE, cursor, direction)
        // 칸이 바뀐 키(커서 +0x25)면 고른 칸을 튕긴다 — 시작 0x7a005(격자, 1, 1, 0) 의 [격자+6] = 1 (0x1e1b0). 키 0x1daa4 가 방향을 적는다
        if (next !== cursor) bounceStart(direction)
        return setCursor(next)
      }
      if (OK_KEYS.has(event.key)) {
        event.preventDefault()
        pressOk(cursor)
        return
      }
      if (BACK_KEYS.has(event.key)) {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
