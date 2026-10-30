import { useEffect, useEffectEvent } from 'react'
import type { RefObject } from 'react'
import { setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'

/** 판정을 부르는 상태 틱 (0x29520 `cmp r3,#0xa`) */
const TOP_MENU_REWARD_TICK = 10

/**
 * 처음 메뉴(하위 4)에 들어선 지 열 번째 갱신 — 전부 수집 보상 판정 0x28e98 (0x2951e~0x29536).
 * 0x29454 의 `[this+0x2c] == 10` 판정도 맨 앞 `[+0xe1] == 0 → 0x29538` 건너뛰기 안이다 — 10번째 갱신에 바퀴가
 * 돌고 있으면 판정을 건너뛰고, 틱은 11 · 12 … 로 넘어가 처음 메뉴에 다시 들어올 때까지 미뤄진다 (r333)
 */
export function useTopMenuTenthTick(isWheel: boolean, turningRef: RefObject<boolean>, onTopMenuTenthTick: (() => void) | undefined) {
  const tenthTick = useEffectEvent(() => onTopMenuTenthTick?.())
  useEffect(() => {
    if (!isWheel) return undefined
    return setAppTickTimeout(() => {
      if (!turningRef.current) tenthTick()
    }, TOP_MENU_REWARD_TICK)
  }, [isWheel, turningRef])
}
