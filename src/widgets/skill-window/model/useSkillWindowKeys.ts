import { useEffect } from 'react'
import { TAB_COUNT } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { GridDirection } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { SkillWindowState } from '@/widgets/skill-window/model/useSkillWindowState'

/** 방향키 → 격자 방향 */
const DIRECTION_OF_KEY: ReadonlyMap<string, GridDirection> = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
])
const CANCEL_KEYS = new Set(['Escape', 'Backspace'])

/** 탭 좌우 = 탭 바꾸기(2칸 감기) */
const TAB_STEP = { left: -1, right: 1 } as const

/**
 * **키**
 * - 탭: 좌우 = 탭 바꾸기(2칸 감기). 확인(−5·'5')·아래(−2·'8') = 격자로 들어가며 두 격자 커서를 (0,0) 으로 (0x81a28).
 *   취소 = 창을 닫고 106 으로.
 * - 격자: 방향키 = 그 탭의 격자 이동(0x6c298, 감기 + 굴림). 취소 = 탭으로 돌아가며 스킬 격자 커서·굴림을 (0,0) 으로 (0x8460c).
 *   확인은 스킬 탭에서만 0x13140 의 장착 갈래, 서브아이템 탭에서는 목록 키로 넘어가 아무 일도 없다.
 * 대화가 떠 있으면 MessageBox 가 먼저 키를 가져간다. 그림마다 다시 건다(그 그림의 칸을 본다)
 */
export function useSkillWindowKeys(state: SkillWindowState, onClose: () => void): void {
  useEffect(() => {
    if (state.prompt !== null) return undefined
    const onKey = (event: KeyboardEvent) => {
      const direction = DIRECTION_OF_KEY.get(event.key) ?? null
      const isCancel = CANCEL_KEYS.has(event.key)
      if (direction === null && !isCancel && event.key !== 'Enter') return
      // 뒤쪽 관리 화면의 키 처리(취소 = 창 닫기)보다 먼저 받는다
      event.preventDefault()
      event.stopImmediatePropagation()
      if (isCancel) return state.focus === '격자' ? state.leaveGrid() : onClose()
      if (state.focus === '탭') return applyTabKey(state, event.key, direction)
      applyGridKey(state, direction)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })
}

function applyTabKey(state: SkillWindowState, key: string, direction: GridDirection | null): void {
  if (key === 'Enter' || direction === 'down') return state.enterGrid()
  if (direction !== 'left' && direction !== 'right') return
  state.setTab((current) => (current + TAB_STEP[direction] + TAB_COUNT) % TAB_COUNT)
}

function applyGridKey(state: SkillWindowState, direction: GridDirection | null): void {
  if (direction !== null) return state.moveInGrid(direction)
  if (state.tab === 0) state.confirmAtCursor()
}
