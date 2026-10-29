import { useCallback, useState } from 'react'

/**
 * 105 진입 — 세션에 알리고(`onReenter`) 커맨드 줄이 칸을 처음 자리로 되돌려 다시 펼치게 센다(0x11910 11c26 → 0x7ff21).
 * 센 수는 이 화면 안에서 105 에 다시 들어온 수다 (`PitcherManagementMenu.entryCount`).
 *
 * 돌려주는 차례: [센 수, 105 진입]
 */
export function useReentry(onSessionReenter: ((from?: number) => void) | undefined) {
  const [entryCount, setEntryCount] = useState(0)
  const onReenter = useCallback(
    (from?: number) => {
      setEntryCount((count) => count + 1)
      onSessionReenter?.(from)
    },
    [onSessionReenter],
  )
  return [entryCount, onReenter] as const
}
