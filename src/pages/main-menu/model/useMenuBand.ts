import { useEffect, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { MENU_BAND_GROW_TICKS, menuBandStateAt } from '@/pages/main-menu/lib/mainMenuLayout'
import type { MenuBandState } from '@/pages/main-menu/lib/mainMenuLayout'

/** 처음 메뉴(하위 4) — 띠를 그리지 않는다 */
const CLOSED: MenuBandState = { spread: 0, isGrowing: false }

/**
 * 아랫단 바탕 띠가 자라는 연출 (`[메뉴+0xe4]` · `[메뉴+0xe2]`).
 *
 * 원본은 **갱신 한 번에 한 칸**씩 ×4 로 키운다 (0x254e4). 웹판도 rAF 가 아니라 원본 틱
 * `millisecondsPerFrame()` 으로 센다 — `useMenuTurn` 과 같은 방식이다.
 *
 * **언제 1 로 되돌리는가** — `[0xe2] = 1 · [0xe4] = 1` 을 넣는 곳은 둘이다 (예전 주석의 "0x23846·0x254e6·0x25512 뿐" 은
 * 처음 메뉴 OK 의 `adds r3,#0xe2 ; strb ; adds r3,#2 ; strh` 를 놓쳤다 — 0x294b8 을 직접 떴다):
 * - 장면 생성자 0x2381c~0x23846: 전역 `[0x140006c]` 가 5 나 0x11 이면 (관리 메뉴 취소 · 미션 목록 CLR)
 * - **처음 메뉴 OK 0x294b8~0x294c2**: `adds r3,#0xe2 ; strb 1 ; adds r3,#2 ; strh 1` — 칸이 무엇이든 OK 마다
 * 그래서 처음 메뉴에서 [게임시작]·[랭킹] 으로 내려갈 때마다 띠는 1 에서 다시 자란다. 다 자라면 0x25512 가 `[0xe2]` = 0.
 * 0x2524c 는 하위 5·6·9 그리기만 부르므로 하위 16·17(선수 고르기)에 있는 동안은 자라지 않는다.
 *
 * `isOpen` 이 거짓 → 참으로 바뀔 때마다(처음 메뉴 OK 로 내려옴) 1 부터 다시 자란다.
 * 처음부터 열려 있으면(장면이 하위 5 로 바로 섬) `startsGrown` 이 거짓일 때만 자라고, 참이면(같은 장면의 하위 16·17 에서 CLR 로
 * 돌아옴 — 생성자를 안 지나 `[0xe4]` 는 앞서 다 자란 160 그대로) 처음부터 다 펼쳐져 있다.
 */
export function useMenuBand(isOpen: boolean, startsGrown = false): MenuBandState {
  const [tick, setTick] = useState(() => (isOpen && startsGrown ? MENU_BAND_GROW_TICKS : 0))
  /** 몇 번째로 열렸는가 — 바뀔 때마다 자라기를 새로 센다 */
  const [opening, setOpening] = useState(0)
  const [wasOpen, setWasOpen] = useState(isOpen)
  // 렌더 중에 되감는다 — 효과에서 되감으면 내려온 첫 장이 다 자란 띠로 한 번 번쩍이고 그 사이 키가 샌다
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setTick(0)
      setOpening((count) => count + 1)
    }
  }

  const isGrowing = isOpen && tick < MENU_BAND_GROW_TICKS
  useEffect(() => {
    if (!isGrowing) return undefined
    const startedAt = performance.now()
    let handle = 0
    const step = (now: number) => {
      // rAF 가 startedAt 직전 타임스탬프로 들어올 때가 있어 0 아래로는 안 내려가게 막는다
      const next = Math.max(0, Math.floor((now - startedAt) / millisecondsPerFrame()))
      setTick(next)
      if (next >= MENU_BAND_GROW_TICKS) return
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때마다 한 번 센다
  }, [opening, isOpen])

  // 닫혀 있으면(처음 메뉴) 띠는 안 그리고 키도 안 막는다 — 처음 메뉴 갱신 0x29454 는 [0xe2] 를 안 본다
  return isOpen ? menuBandStateAt(tick) : CLOSED
}
