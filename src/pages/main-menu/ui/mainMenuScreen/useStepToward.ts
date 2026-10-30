import { useEffect, useRef } from 'react'
import type { MainMenuAction } from '@/pages/main-menu/model/mainMenu'
import type { MainMenuTier } from '@/pages/main-menu/model/mainMenu/menuEntries'

/**
 * 칸 누름 = 고르기만 — 그 칸까지 남은 걸음(+ ↓ · − ↑). 원본 키 한 번이 한 칸을 돌리므로(0x24c58 · 0x253a6) 한 걸음씩 보내고,
 * 앞 걸음의 회전 연출이 끝나면(`isTurning` 이 거짓으로 돌아오면) 다음 걸음을 보낸다. ⚠️ 웹 조작 — 원본은 키패드뿐이다.
 * 효과 둘(그림마다 · 단이 바뀔 때)은 옛 차례 그대로 이 자리에서 건다.
 */
export function useStepToward(isTurning: boolean, isBandGrowing: boolean, tier: MainMenuTier, dispatch: (action: MainMenuAction) => void) {
  const pendingStepsRef = useRef(0)
  const hasTurnStartedRef = useRef(false)
  const stepOnce = () => {
    const step = pendingStepsRef.current > 0 ? 1 : -1
    pendingStepsRef.current -= step
    hasTurnStartedRef.current = false
    dispatch({ type: '커서', step })
  }
  const stepToward = (offset: number) => {
    // 도는 중이거나 띠가 자라는 중(하위 5·9 가 키를 버린다 0x28cc2)이면 원본 키처럼 받지 않는다
    if (offset === 0 || pendingStepsRef.current !== 0 || isTurning || isBandGrowing) return
    pendingStepsRef.current = offset
    stepOnce()
  }
  useEffect(() => {
    if (isTurning) {
      hasTurnStartedRef.current = true
      return
    }
    if (pendingStepsRef.current !== 0 && hasTurnStartedRef.current) stepOnce()
  })
  // 단이 바뀌면(뒤로 · 시작) 남은 걸음을 버린다
  useEffect(() => {
    pendingStepsRef.current = 0
  }, [tier])
  return stepToward
}
