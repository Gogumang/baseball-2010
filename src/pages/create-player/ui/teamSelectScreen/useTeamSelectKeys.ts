import { useEffect, useEffectEvent, type Dispatch, type SetStateAction } from 'react'
import { isTeamOpen, OPEN_TEAM_COUNT, TEAM_GRID_SHAPE } from '@/pages/create-player/lib/teamSelectLayout'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import { moveGridCursor, type AnnalsGridShape } from './otherSlices'

type GridDirection = 'left' | 'right' | 'up' | 'down'

/**
 * 격자가 돌려주는 방향 — 장면 키(나만의리그 0x14114 · 시즌 0xca 0x8da4 · 트레이드 0xe4 0x8250 · 일반모드 18 0x29b38 · 19 0x29c98)는
 * 모두 키 [this+0x40] 을 걸러 내지 않고 격자 vt+0x18(0x6c299 → 0x6c521 → 0x6c031)에 그대로 넘긴다 —
 * 숫자키 꼴 1 이라 '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK(−5) 로 돌아온다 (표 0xd2e7c).
 */
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

/** 확인으로 등록에 넘어가는 칸 — 열린 칸, 나만의리그면 히든 줄 밖 (0x14114) */
export function isTeamSelectable(teamId: number, openedHiddenIds: readonly number[], hiddenTeamsSelectable: boolean) {
  return isTeamOpen(teamId, openedHiddenIds) && (hiddenTeamsSelectable || teamId < OPEN_TEAM_COUNT)
}

/** 키가 고르는 손잡이 · 칸 규칙 — 화면이 기본값을 채운 그대로 */
export interface TeamSelectKeyOptions {
  /** 안 주면 `TEAM_GRID_SHAPE` */
  readonly gridShape: AnnalsGridShape | undefined
  readonly openedHiddenIds: readonly number[]
  readonly hiddenTeamsSelectable: boolean
  readonly onSelect: (teamId: number) => void
  readonly onSelectLocked: ((teamId: number) => void) | undefined
  readonly onCancel: () => void
}

/**
 * 팀 고르기 키 — 방향은 격자 커서를 옮기고(칸이 바뀌면 그 방향으로 튕긴다, `bounce`), OK 는 고를 수 있는 칸이면 고르고 아니면
 * 잠긴 칸 손잡이로, Escape 는 물러난다. 열림 애니가 끝날 때까지(`keyLock`) 아무것도 안 한다.
 * 등록 차례는 옛 그대로 — deps 가 바뀔 때만 다시 건다(다른 처리기와의 차례 유지). 처리는 그때 렌더 값으로
 */
export function useTeamSelectKeys(
  cursor: number,
  setCursor: Dispatch<SetStateAction<number>>,
  keyLock: { readonly current: boolean },
  bounceStart: (direction: GridDirection) => void,
  options: TeamSelectKeyOptions,
) {
  const { openedHiddenIds, hiddenTeamsSelectable, onSelect, onSelectLocked, onCancel } = options
  const gridShape = options.gridShape ?? TEAM_GRID_SHAPE
  const pressOkOrCancel = (event: KeyboardEvent) => {
    const isOk = event.key === 'Enter' || event.key === '5'
    if (isOk && isTeamSelectable(cursor, openedHiddenIds, hiddenTeamsSelectable)) {
      event.preventDefault()
      onSelect(cursor)
    } else if (isOk && onSelectLocked !== undefined) {
      event.preventDefault()
      onSelectLocked(cursor)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (keyLock.current) return
    const direction = GRID_DIRECTIONS.get(event.key) ?? null
    if (direction !== null) {
      // 격자가 돌려준 키를 곧바로 0x5550d 에 넘긴다(0x8250 828c · 0x8da4 8de0 · 0x14114 1414a · 0x29b38 29b66 · 0x29c98 29cc6) —
      // 숫자키도 방향으로 까딱임 방향 [skin+0x8c] 에 남는다(Q-10)
      noteSkinShakeDirection(direction)
      event.preventDefault()
      const next = moveGridCursor(gridShape, cursor, direction)
      // 칸이 바뀐 키(커서 +0x25)면 0x7a571 이 고른 칸을 그 방향으로 튕긴다 (`useGridCursorBounce`)
      if (next !== cursor) bounceStart(direction)
      return setCursor(next)
    }
    pressOkOrCancel(event)
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cursor, openedHiddenIds, hiddenTeamsSelectable, gridShape, onSelect, onSelectLocked, onCancel, bounceStart])
}
