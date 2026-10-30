import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * **키 길** — 나리 장면 0x1cdec 의 키 갈래(1d06a~1d09a)는 공용 창 0x754f9 가 키를 안 먹고 이 틀에 누름([this+0x34])이 있으면
 * 상태 표 0xcc7e0[상태 − 0x66] 으로 간다. [0x27](141) = 0x1d12c → `bl 0x1220c` 이고, 0x1220c 는 키 값([this+0x40])을 읽지 않는다 —
 * **어느 키든** 화면 탭(`press`)과 같다(직접 떴다). 팝업이 떠 있는 단계는 창이 키를 먹는다(`MessageBox` — 그동안 `press` 가 없다).
 * 되풀이(+0x38)는 누름이 아니라 거른다. 키가 볼 누름은 커밋 때 적는다
 */
export function useEndingPressKey(press: (() => void) | undefined) {
  const pressRef = useRef<(() => void) | undefined>(undefined)
  useLayoutEffect(() => {
    pressRef.current = press
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = pressRef.current
      if (event.repeat || current === undefined) return
      event.preventDefault()
      current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
