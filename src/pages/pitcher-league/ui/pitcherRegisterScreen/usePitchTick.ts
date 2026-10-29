import { useEffect, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'

/**
 * 0x67 상태 틱 [this+0x2c] — '변화구'(0x67) 에 들 때마다 0 부터(드는 렌더에서 맞춘다), 그 뒤 앱 틱마다 +1.
 * '등록' 동안은 멈춰 마지막 값을 든다(CLR 로 돌아갈 때 띠가 이어받는다).
 */
export function usePitchTick(isPitchPhase: boolean): number {
  const [pitchTick, setPitchTick] = useState(0)
  const [wasPitchPhase, setWasPitchPhase] = useState(isPitchPhase)
  if (wasPitchPhase !== isPitchPhase) {
    setWasPitchPhase(isPitchPhase)
    if (isPitchPhase) setPitchTick(0)
  }
  useEffect(() => {
    if (!isPitchPhase) return undefined
    const timer = setAppTickInterval(() => setPitchTick((previous) => previous + 1))
    return () => timer()
  }, [isPitchPhase])
  return pitchTick
}
