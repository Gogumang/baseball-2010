import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useInGameMenuOpenOnHide, type InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { CONFIRM_KEYS, type MenuOverlay } from './derbyScreenProps'
import { acceptsDerbyConfirm, acceptsDerbyMenuKey, isDerbyPlayRunning } from './derbySceneKeyFlags'

/** 키 하나를 창에 건다 — `isOn` 동안만, 되풀이(+0x38)는 누름이 아니라 거른다 */
function useWindowKey(isOn: boolean, accepts: (event: KeyboardEvent) => boolean, onKey: () => void) {
  useEffect(() => {
    if (!isOn) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !accepts(event)) return
      onKey()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOn, accepts, onKey])
}

/**
 * **경기 장면 키** — 0xe 의 OK · 판(0x17)의 건너뛰기 키는 받은 그 자리에서 처리하지 않고 장면 키 칸에 든다 — 원본은 키 콜백이 [+0x20] 에
 * 적기만 하고 다음 틀의 0xbca05 → 키 0x498d4(52d9e) → 0x536bc 가 그 틀의 상태로 가른다(0xe 0x532b0 · 0x17 0x53420 → 0x587 → 0x519cc).
 * 타석(`BattingStage`)이 칸을 올려 두었으면 그 틀 머리에서 꺼낸다(`pushSceneKey` — 없으면 바로). 꺼낸 틀의 상태를 다시 본다.
 *
 * '\*' 는 원본 공용 키 처리 `0x498d4` 의 '\*'(소프트키1 −6 도 '\*', 498e8) — 경기 상태 0xd~0x15 면 경기 중 메뉴 0x3c02c 를 연다
 * (4991c~49922 — 모드를 안 본다). 받은 다음 틀의 키 0x498d4 '*' 가지(49918~49948)가 열고, 창이 서 있으면(메뉴 열림) 창 키 자리
 * (52cc6 0x754f9 → 0x3c158)에서 닫는다(`pressStar` — 앱 키 문이 다음 앱 틱에 넘긴다). 0x463ac(463e6 0x741a1)는 키가 아니라
 * 장면 vtable 0xcfa0c [6] 멈춤 콜백(0xcfa24)이 같은 메뉴를 여는 자리다 — 단말 일시정지도 '*' 가 받는 때 · 하위 창 없음이면 연다
 */
export function useDerbySceneKeys(session: HomeRunDerbySession, menu: InGameMenuState, overlay: MenuOverlay | null) {
  const acceptsConfirm = acceptsDerbyConfirm(session, menu.isOpen, overlay)
  const isPlayRunning = isDerbyPlayRunning(session, menu.isOpen, overlay)
  const acceptsMenuKey = acceptsDerbyMenuKey(session, menu.isOpen, overlay)
  const { confirm, skipHomeRun } = session
  const sceneKeyStateRef = useRef({ acceptsConfirm, isPlayRunning })
  useLayoutEffect(() => {
    sceneKeyStateRef.current = { acceptsConfirm, isPlayRunning }
  })
  const pressConfirm = useCallback(() => {
    pushSceneKey(() => {
      if (sceneKeyStateRef.current.acceptsConfirm) confirm()
    })
  }, [confirm])
  const pressSkip = useCallback(() => {
    // 처리하는 틀 = 받은 틀 + 1 — 판 시각은 그 틀(키 틱)로 센다
    const keyTick = gameSceneTickNow() + 1
    pushSceneKey(() => {
      if (sceneKeyStateRef.current.isPlayRunning) skipHomeRun(keyTick)
    })
  }, [skipHomeRun])
  useWindowKey(isPlayRunning, acceptsAnyKey, pressSkip)
  useWindowKey(acceptsConfirm, acceptsConfirmKey, pressConfirm)
  useInGameMenuOpenOnHide(menu, acceptsMenuKey && overlay === null)
  useWindowKey(acceptsMenuKey, acceptsStarKey, menu.pressStar)
  return { acceptsConfirm, isPlayRunning, pressConfirm, pressSkip }
}

const acceptsAnyKey = () => true
const acceptsConfirmKey = (event: KeyboardEvent) => {
  if (!CONFIRM_KEYS.has(event.key)) return false
  event.preventDefault()
  return true
}
const acceptsStarKey = (event: KeyboardEvent) => {
  if (event.key !== '*') return false
  event.preventDefault()
  return true
}
