import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { nextPanelFold, openingFold } from '@/pages/settings/lib/settingsLayout'
import type { PanelFold } from '@/pages/settings/lib/settingsLayout'

/**
 * 판 펼침·접힘 (`nextPanelFold`) — 처음 들어오면 0x20 부터 펼친다. 하위 페이지에서 돌아온 첫 화면은 그 페이지가
 * 이미 다 편 판 그대로다(0x259fc 가 앞 상태 0x20~0x22 면 플래그를 안 건드린다) — 이 화면은 하위 페이지 동안에도
 * 그대로 서 있어 다 편 상태를 들고 있다.
 *
 * 앱 틱마다 한 걸음 — 0x5a6fe 는 0x593c8 이 판을 그린 뒤에만 부른다(`isPageShown` 이 거짓이면 멈춘다). 접힘이 끝나면 `onClosed`.
 */
export function usePanelFold(isPageShown: boolean, panelHeight: number, onClosed: () => void) {
  const isPageShownNow = useEffectEvent(() => isPageShown)
  const [fold, setFold] = useState<PanelFold>(openingFold)
  // 틱 · 나가기가 이어 읽는 판 — 틱이 그 자리에서 고쳐 쓰고, 렌더 값은 커밋 때 맞춘다
  const foldRef = useRef(fold)
  useLayoutEffect(() => {
    foldRef.current = fold
  })
  const back = useEffectEvent(onClosed)
  const isFolding = !fold.isDone
  useEffect(() => {
    if (!isFolding) return undefined
    const timer = setAppTickInterval(() => {
      // 0x5a6fe 는 0x593c8 이 판을 그린 뒤에만 부른다 — 머리띠가 미끄러지는 동안은 펼침도 멈춘다
      if (!isPageShownNow()) return
      const next = nextPanelFold(foldRef.current, panelHeight)
      // 접힘이 끝나면 갱신 끝 0x29688 이 상태 4 로 — 10 높이 판은 그려지지 않는다
      if (!next.isOpening && next.isDone) {
        timer()
        foldRef.current = next
        return back()
      }
      foldRef.current = next
      setFold(next)
    })
    return () => timer()
  }, [isFolding, panelHeight])
  return { fold, setFold, foldRef }
}
