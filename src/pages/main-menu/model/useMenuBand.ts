import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  MENU_BAND_GROW_TICKS, MENU_BAND_MAX_SPREAD, menuBandStateAt,
} from '@/pages/main-menu/lib/mainMenuLayout'
import type { MenuBandState } from '@/pages/main-menu/lib/mainMenuLayout'

/** 다 자란 뒤의 상태 — `[메뉴+0xe4]` 는 160 에 머무르고 `[메뉴+0xe2]` 는 0 이다 */
const GROWN: MenuBandState = { spread: MENU_BAND_MAX_SPREAD, isGrowing: false }

/**
 * 아랫단 바탕 띠가 자라는 연출 (`[메뉴+0xe4]` · `[메뉴+0xe2]`).
 *
 * 원본은 **갱신 한 번에 한 칸**씩 ×4 로 키운다 (0x254e4). 웹판도 rAF 가 아니라 원본 틱
 * `millisecondsPerFrame()` 으로 센다 — `useMenuTurn` 과 같은 방식이다.
 *
 * ⚠️ **언제 켜지는지는 근사다.** 원본은 장면을 만들 때 전역 `[0x140006c]` 가 5 나 0x11 이면
 * `[0xe2] = [0xe4] = 1` 을 넣고(0x2381c~0x23846), 그 밖에는 손대지 않는다. 곧 **"게임시작
 * 목록으로 바로 열어라" 로 들어올 때만** 연출이 돌고, 윗단 바퀴에서 OK 로 내려온 경우에는
 * `[0xe4]` 가 0 이라 띠가 아예 안 보인다. 웹판에는 아직 그 직행 경로가 없어 **아랫단에 들어올 때**
 * 켠다. 원본과 다른 점은 이 한 가지뿐이고, 켜진 뒤 동작은 원본 그대로다.
 *
 * 한 번 다 자란 `[0xe4]` 를 0 으로 되돌리는 코드는 **없다**(.text 전체에서 0xe4 를 쓰는 곳은
 * 0x23846·0x254e6·0x25512 뿐이다). 그래서 윗단으로 올라갔다가 다시 내려오면 띠는 **연출 없이
 * 처음부터 다 펼쳐진 채로** 나온다 — `hasGrownRef` 가 그 자리다.
 */
export function useMenuBand(isOpen: boolean): MenuBandState {
  // 첫 그림부터 0 이어야 한다 — 다 자란 값으로 시작하면 효과가 돌기 전 한 장이 활짝 펼쳐져 번쩍인다
  const hasGrownRef = useRef(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isOpen) return undefined
    if (hasGrownRef.current) {
      setTick(MENU_BAND_GROW_TICKS)
      return undefined
    }

    setTick(0)
    const startedAt = performance.now()
    let handle = 0
    const step = (now: number) => {
      // rAF 가 startedAt 직전 타임스탬프로 들어올 때가 있어 0 아래로는 안 내려가게 막는다
      const next = Math.max(0, Math.floor((now - startedAt) / millisecondsPerFrame()))
      setTick(next)
      if (next >= MENU_BAND_GROW_TICKS) {
        hasGrownRef.current = true
        return
      }
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [isOpen])

  return hasGrownRef.current ? GROWN : menuBandStateAt(tick)
}
