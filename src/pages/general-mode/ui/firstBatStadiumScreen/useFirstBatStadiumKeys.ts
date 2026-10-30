import { useEffect } from 'react'
import { useFrameSlideKeyLock } from '@/widgets/screen-frame/model/useFrameSlideKeyLock'
import { noteSkinShakeDirection, noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { stadiumCursorAfter } from '@/pages/general-mode/lib/generalModeSetup'
import { firstBatStadiumKeyActionOf } from '@/pages/general-mode/lib/firstBatStadiumKeys'
import type { FirstBatStadiumKeyAction } from '@/pages/general-mode/lib/firstBatStadiumKeys'

/** 숫자키 꼴 1 격자가 방향으로 바꾸는 키 (표 0xd2e7c) */
const GRID_NUMERIC_DIRECTIONS: Readonly<Record<string, 'left' | 'right' | 'up' | 'down'>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  4: 'left',
  6: 'right',
  2: 'up',
  8: 'down',
}

/**
 * 0x5550d — 까딱임 방향 [skin+0x8c] (Q-10). 단계 0([skin+0xcc] == 0)은 **날 키**(0x289ba~0x289c6), 단계 1 은 구장 격자
 * [this+0x74](진입 0x23f18 `vt+0x1c(10, 1, 숫자키 꼴 1, 0x10)`)의 vt+0x18 이 바꾼 키(0x28a36~0x28a4a) — '2' '4' '6' '8' 도 방향
 */
function noteShakeOfKey(isStadiumPhase: boolean, key: string) {
  if (!isStadiumPhase) return noteSkinShakeKey(key)
  const direction = GRID_NUMERIC_DIRECTIONS[key]
  if (direction !== undefined) noteSkinShakeDirection(direction)
}

export interface FirstBatStadiumKeyHandlers {
  readonly isStadiumPhase: boolean
  readonly playerSide: PlayerSide
  readonly stadiumId: number
  readonly onMoveFirstBat: (side: PlayerSide) => void
  readonly onChooseFirstBat: (side: PlayerSide) => void
  readonly onChooseStadium: (stadiumId: number) => void
  readonly onMoveStadium: (stadiumId: number) => void
  readonly onCancel: () => void
}

function runKeyAction(action: Exclude<FirstBatStadiumKeyAction, 'none'>, handlers: FirstBatStadiumKeyHandlers) {
  const { isStadiumPhase, playerSide, stadiumId } = handlers
  switch (action) {
    // 단계 0 CLR → 19 · 단계 1 CLR · ↑ · '2' → 단계 0 (구장 커서는 rec+0xc 에 남는다 — 커서가 곧 rec+0xc 다)
    case 'back':
      return handlers.onCancel()
    // 단계 0 — 좌·우가 선공 커서(skin+0x74)를 뒤집는다
    case 'flip':
      return handlers.onMoveFirstBat(playerSide === PLAYER_SIDE_FIRST_BAT ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT)
    // 구장 목록은 꼴 0x10 — 끝에서 감는다 (0x6bead)
    case 'previous':
      return handlers.onMoveStadium(stadiumCursorAfter(stadiumId, -1))
    case 'next':
      return handlers.onMoveStadium(stadiumCursorAfter(stadiumId, 1))
    // 단계 0 OK 는 rec+8 에 적으며 단계 1 로, 단계 1 OK 는 rec+0xc 에 적고 21 로
    case 'ok':
      return isStadiumPhase ? handlers.onChooseStadium(stadiumId) : handlers.onChooseFirstBat(playerSide)
  }
}

/** 갱신 0x2896c 의 키 — 숫자키도 원본 키 함수대로 (`firstBatStadiumKeyActionOf` — Q-14) */
export function useFirstBatStadiumKeys(handlers: FirstBatStadiumKeyHandlers) {
  const { isStadiumPhase, playerSide, stadiumId, onMoveFirstBat, onChooseFirstBat, onChooseStadium, onMoveStadium, onCancel } = handlers
  // 머리띠가 미끄러지는 동안 키 함수가 [skin+0xe4] == 0 을 보고 아무것도 안 한다 (`useFrameSlideKeyLock`)
  const keyLock = useFrameSlideKeyLock()
  useEffect(() => {
    const current: FirstBatStadiumKeyHandlers = {
      isStadiumPhase,
      playerSide,
      stadiumId,
      onMoveFirstBat,
      onChooseFirstBat,
      onChooseStadium,
      onMoveStadium,
      onCancel,
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyLock.current) return
      noteShakeOfKey(isStadiumPhase, event.key)
      const action = firstBatStadiumKeyActionOf(isStadiumPhase, event.key)
      if (action === 'none') return
      event.preventDefault()
      runKeyAction(action, current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStadiumPhase, playerSide, stadiumId, onMoveFirstBat, onChooseFirstBat, onChooseStadium, onMoveStadium, onCancel, keyLock])
}
