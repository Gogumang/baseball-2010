import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **이벤트 재생의 끝 틀** — 나리 114 · 시즌 0xd3 (직접 떴다).
 *
 * 한 틀은 상태 적용 0xbc9c8 → 진입 → 키 → 갱신 → 그리기 차례다(장면 0x106 틀 0x1cdec: 1ce02 → 진입표 → 키표 0xcc7e0 → 갱신
 * 1d1b2 → 앞그림 0x16a34 → 그리기표 0xcc884). 114 갱신 0x1c014 의 0x8cf65 가 마지막 명령 뒤 끝(8d8f6 `0x8a380` 이 관리자의
 * [+0x10] · [+0x11] 을 0 으로)을 알리면 다음 상태를 **예약**(0xbcb49 — 다음 틀에 적용)하고, 같은 틀의 그리기 0x19e64 가 부르는
 * 대화창 0x8b5ac 는 `[+0x10] > [+0x11] − 1`(0 > −1)이라 곧장 0 을 돌려준다(8b5be~8b5c2 — 대사 상자 · 초상화를 안 그림). 그러면
 * 0x19e64 가 앞 상태 [this+0x28] ∈ {0x70, 0x71}(112 · 113)이면 외출 지도 0x7ea64(gfx, −1, 0), 그 밖은 0x19da4 = 커맨드 줄
 * 0x7e418 · 상태판 0x7d34c(gfx, 0) · 머리띠를 그린다. 시즌 0xd3 의 그리기 0xa09c 도 같은 꼴이다(앞 상태 0xd1 · 0xd2 → 지도, 그 밖
 * 공통 틀 0x9f60 — 같은 커맨드 줄 · 상태판(0) · 머리띠).
 *
 * 곧 이벤트가 끝나면 **한 틀** 동안 대화창 없는 그 그림이 서고, 다음 틀에 다음 상태로 넘어간다. 웹은 끝을 받으면 그 한 틀
 * (`millisecondsPerFrame` — 속도 설정의 갱신 간격) 동안 `isEnding` 을 세우고, 그 뒤에 넘긴다.
 */
export function useEventEndFrame<A extends readonly unknown[]>(complete: (...args: A) => void): {
  readonly isEnding: boolean
  readonly end: (...args: A) => void
} {
  const [pending, setPending] = useState<A | null>(null)
  const completeRef = useRef(complete)
  completeRef.current = complete
  useEffect(() => {
    if (pending === null) return
    const timer = setTimeout(() => {
      setPending(null)
      completeRef.current(...pending)
    }, millisecondsPerFrame())
    return () => clearTimeout(timer)
  }, [pending])
  return { isEnding: pending !== null, end: (...args: A) => setPending(args) }
}
