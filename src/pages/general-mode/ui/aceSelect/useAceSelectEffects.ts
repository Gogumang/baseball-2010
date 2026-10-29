import { useEffect, useEffectEvent, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { noteSkinShakeDirection, noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import type { GridBounceDirection } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { ACE_PER_ROLE, ACE_PHASE } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import { aceGridShapeOf, aceKeyDirectionOf, isAceDirectionPassed } from './aceSelectRules'
import type { AceSelectMode } from './aceSelectRules'
import { moveGridCursor } from './otherSlices'
import type { AnnalsDirection } from './otherSlices'

/**
 * 단계가 바뀌면 커서를 옮긴다. 마투수 OK 는 (0, 1) = 칸 5 로 내린다(시즌 0xa78e~0xa798).
 * 마타자 단계의 CLR 은 커서를 **고른 마투수 칸**(rec+0xe)으로 되돌린다 — +0xc = 칸 % 열 · +0x10 = 칸 / 열
 * (시즌 0xa91c~0xa94a · 일반모드 상태 21 0x2a0bc~0x2a0e2, 0xca911 나머지 · 0xca7b5 몫). 0 칸이 아니다.
 */
export function useCursorFollowsPhase(phase: AcePhase, chosenPitcherCell: number | null, setCursor: Dispatch<SetStateAction<number>>) {
  const previousPhaseRef = useRef(phase)
  useEffect(() => {
    if (previousPhaseRef.current === phase) return
    previousPhaseRef.current = phase
    const isChosen = chosenPitcherCell !== null && chosenPitcherCell >= 0 && chosenPitcherCell < ACE_PER_ROLE
    setCursor(phase === ACE_PHASE.마투수 ? (isChosen ? chosenPitcherCell : 0) : ACE_PER_ROLE)
  }, [phase, chosenPitcherCell, setCursor])
}

/** 열 칸이 다 열린 것을 본 그림에 히든 팀 외인구단을 연다 (`AceSelectScreenProps.onAllAcesOpen`) */
export function useAllAcesOpenNotice(isEveryAceOpenSeen: boolean, onAllAcesOpen: (() => void) | undefined) {
  const allAcesOpen = useEffectEvent(() => onAllAcesOpen?.())
  useEffect(() => {
    if (isEveryAceOpenSeen) allAcesOpen()
  }, [isEveryAceOpenSeen])
}

/**
 * 격자 키 — 상태 21 (0x29df8) · 상태 28 (0x2af20) · 코치채용(시즌 0xd7 키 0xa248). 방향 키 갈래는 `aceKeyDirectionOf` 머리말.
 * 커서·열린 목록·단계를 모두 보는 닫힘이라 **매 그림마다** 새로 건다 (의존 목록 없음)
 */
export function useAceGridKeys(
  keyLock: RefObject<boolean>,
  isGridBlocked: boolean,
  mode: AceSelectMode,
  cursor: number,
  startBounce: (direction: GridBounceDirection) => void,
  setCursor: Dispatch<SetStateAction<number>>,
  pressCell: (cell: number) => void,
  requestLevelUp: (cell: number) => void,
  onCancel: () => void,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyLock.current || isGridBlocked) return undefined
      const direction = aceKeyDirectionOf(event.key)
      noteAceShake(mode, event.key, direction)
      if (direction === null)
        return pressAceCommandKey(event, () => pressCell(cursor), mode === '코치' ? null : () => requestLevelUp(cursor), onCancel)
      event.preventDefault()
      if (!isAceDirectionPassed(mode, direction)) return undefined
      const next = moveGridCursor(aceGridShapeOf(mode), cursor, direction)
      // 칸이 바뀐 키(커서 +0x25)면 고른 칸을 튕긴다 — 0x7a005(격자, 1, 1, 1) 의 [격자+6] = 1 (0x64836)
      if (next !== cursor) startBounce(direction)
      return setCursor(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // 커서·열린 목록·단계를 모두 보는 닫힘이라 **매 그림마다** 새로 건다 (의존 목록 없음)
  })
}

/**
 * 팝업(0x5fb25)이 키를 안 가져갔으면 0x5550d 에 넘긴다 — 까딱임 방향 [skin+0x8c] (Q-10).
 * 상태 21 0x29df8(29e4a~29e54) · 시즌 0xd7 0xa248(a4fc~a50a)은 **날 키**(숫자키는 안 적힌다), 상태 28 0x2af20(2af68~2af7e)은
 * 격자가 바꾼 키(숫자키도 방향)
 */
function noteAceShake(mode: AceSelectMode, key: string, direction: AnnalsDirection | null) {
  if (mode !== '레벨업') noteSkinShakeKey(key)
  else if (direction !== null) noteSkinShakeDirection(direction)
}

/** 방향 밖의 키 — 확인(Enter · '5') OK 한 번 · '0' 레벨업(코치채용은 없음) · 취소 */
function pressAceCommandKey(event: KeyboardEvent, pressCursor: () => void, requestLevelUp: (() => void) | null, onCancel: () => void) {
  if (event.key === 'Enter' || event.key === '5') {
    event.preventDefault()
    return pressCursor()
  }
  if (event.key === '0' && requestLevelUp !== null) {
    event.preventDefault()
    return requestLevelUp()
  }
  if (event.key !== 'Escape') return undefined
  event.preventDefault()
  return onCancel()
}
