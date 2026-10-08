import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  MENU_BAND_GROW_TICKS, MENU_BAND_MAX_SPREAD, menuBandStateAt,
} from '@/pages/main-menu/lib/mainMenuLayout'
import type { MenuBandState } from '@/pages/main-menu/lib/mainMenuLayout'

/** 다 자란 뒤의 상태 — `[메뉴+0xe4]` 는 160 에 머무르고 `[메뉴+0xe2]` 는 0 이다 */
const GROWN: MenuBandState = { spread: MENU_BAND_MAX_SPREAD, isGrowing: false }

/**
 * 연출이 안 켜진 장면 — 할당기 0x2ac4 가 장면 객체를 0x1400428(memset 0)로 비우므로 `[0xe4]` = `[0xe2]` = 0 이다.
 * 그리기 0x253e8 은 i = 0 한 줄(y = 높이, 화면 바로 밖)만 긋고, 0x254e4 의 ×4 는 0 에 머문다 — 띠는 안 보이고 릴 줄은 그린다.
 */
const NEVER_SEEDED: MenuBandState = { spread: 0, isGrowing: false }

/**
 * 아랫단 바탕 띠가 자라는 연출 (`[메뉴+0xe4]` · `[메뉴+0xe2]`).
 *
 * 원본은 **갱신 한 번에 한 칸**씩 ×4 로 키운다 (0x254e4). 웹판도 rAF 가 아니라 원본 틱
 * `millisecondsPerFrame()` 으로 센다 — `useMenuTurn` 과 같은 방식이다.
 *
 * **언제 켜지는가** — 원본은 장면을 만들 때 전역 `[0x140006c]` 가 5 나 0x11 이면 `[0xe2] = [0xe4] = 1` 을 넣고
 * (0x2381c~0x23846), 그 밖에는 손대지 않는다(장면 객체는 0 으로 비워져 나온다 — 할당기 0x2ac4 → memset 0x1400428).
 * 곧 **"게임시작 목록으로 바로 열어라" 로 장면이 설 때만**(`isSeeded` — 관리 메뉴 취소 등) 연출이 돌고, 윗단 바퀴에서 OK 로
 * 내려온 경우에는 `[0xe4]` 가 0 이라 띠가 아예 안 보인다.
 *
 * 한 번 다 자란 `[0xe4]` 를 0 으로 되돌리는 코드는 **없다**(.text 전체에서 0xe4 를 쓰는 곳은
 * 0x23846·0x254e6·0x25512 뿐이다). 그래서 윗단으로 올라갔다가 다시 내려오면 띠는 **연출 없이
 * 처음부터 다 펼쳐진 채로** 나온다 — `hasGrownRef` 가 그 자리다.
 *
 * ⚠️ 0x11 로 세우는 길은 웹에 없다(그 값을 쓰는 곳 미확인).
 */
export function useMenuBand(isOpen: boolean, isSeeded: boolean): MenuBandState {
  // 첫 그림부터 0 이어야 한다 — 다 자란 값으로 시작하면 효과가 돌기 전 한 장이 활짝 펼쳐져 번쩍인다
  const hasGrownRef = useRef(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isOpen || !isSeeded) return undefined
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
  }, [isOpen, isSeeded])

  if (!isSeeded) return NEVER_SEEDED
  return hasGrownRef.current ? GROWN : menuBandStateAt(tick)
}
