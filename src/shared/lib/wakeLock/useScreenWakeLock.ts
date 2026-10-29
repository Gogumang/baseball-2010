import { useEffect, useRef } from 'react'
import { createScreenWakeLock } from '@/shared/lib/wakeLock/screenWakeLock'
import type { ScreenWakeLock } from '@/shared/lib/wakeLock/screenWakeLock'

/** `isActive` 인 동안 화면이 꺼지지 않게 한다 — 탭이 숨으면 풀고 돌아오면 다시 잡는다 (`createScreenWakeLock`) */
export function useScreenWakeLock(isActive: boolean): void {
  const lockRef = useRef<ScreenWakeLock | null>(null)
  // 앱 렌더를 더 일으키지 않게 상태가 아닌 ref 에 둔다. 처음 값은 바로 아래 효과가 넣는다(같은 커밋에서 이 차례로 돈다)
  useEffect(() => {
    const lock = createScreenWakeLock({ wakeLock: navigator.wakeLock, document })
    lockRef.current = lock
    return () => {
      lockRef.current = null
      lock.dispose()
    }
  }, [])

  useEffect(() => {
    lockRef.current?.setWanted(isActive)
  }, [isActive])
}
