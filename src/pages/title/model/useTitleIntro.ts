import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { TITLE_KEY_FRAMES_TO_MENU, titleSceneAt } from '@/pages/title/model/titleIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { TitleScene } from '@/pages/title/model/titleIntro'

/**
 * 인트로 시계와 키. 원본 타이틀 갱신 0x245f8 (직접 떴다):
 * ```
 * 24604  r3 = 애니 객체의 지금 프레임 묶음
 * 24612  ldrb [r3+2] ; lsls #0x1d ; bpl 끝   ; 애니 끝 깃발(비트 2)이 안 섰으면 아무 일도 안 한다
 * 24618  [this+0x40](키) == 0 이면 끝
 * 2461e  머리띠 미끄러짐 [skin+0x88] = 0 · [+0x84] = 1 · [+0x86] = 1 → 0xbcb49(this+0x18, 4) 처음 메뉴
 * ```
 * 곧 **인트로 중에 누른 키는 그냥 버려진다** — 인트로를 건너뛰는 길은 없다(예전 웹은 끝까지 넘겼다).
 * 인트로가 끝난 뒤(`isSettled` — 애니 0 이 끝남)에야 아무 키나 받는다.
 * 받은 키는 0xbcb49 **예약**이라(장면 틀 0x32fa0 이 갱신 → 그리기 차례, 다음 틀 머리 0xbc9c9 가 적용) 그리기 d 를 보는 동안
 * 누른 키는 d + 1 을 그린 뒤 d + 2 틀에 메뉴다 — 그때 onStart 를 부른다(`TITLE_KEY_FRAMES_TO_MENU`). 두 번째 키는 이미 예약이
 * 섰으니 아무 일도 없다(같은 4 를 다시 예약할 뿐).
 */
export function useTitleIntro(onStart: () => void): { scene: TitleScene; press: () => void } {
  /** 인트로를 켠 앱 틱 — 그림 수는 (지금 앱 틱 − 이 틱)이다(`appTickOf`) */
  const startTickRef = useRef(appTickNow())
  const [scene, setScene] = useState<TitleScene>(() => titleSceneAt(0))
  /** 키를 받은 그리기 차례 — 메뉴는 이 차례 + 2 틀에 선다 */
  const acceptedAtRef = useRef<number | null>(null)
  const hasStartedRef = useRef(false)
  const onStartLatest = useEffectEvent(onStart)

  useEffect(() => {
    let handle = 0
    const step = (now: number) => {
      const next = titleSceneAt(Math.max(0, appTickOf(now) - startTickRef.current) * millisecondsPerFrame())
      const acceptedAt = acceptedAtRef.current
      if (acceptedAt !== null && next.draw >= acceptedAt + TITLE_KEY_FRAMES_TO_MENU) {
        if (!hasStartedRef.current) {
          hasStartedRef.current = true
          onStartLatest()
        }
        return
      }
      setScene(next)
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [])

  const pressRef = useRef(() => {
    if (acceptedAtRef.current !== null) return
    // 키가 든 때의 그리기 차례 — 그 틀 뒤 갱신이 깃발(그리기 19 가 세움)을 봐야 받는다
    const current = titleSceneAt(Math.max(0, appTickNow() - startTickRef.current) * millisecondsPerFrame())
    if (current.isSettled) acceptedAtRef.current = current.draw
  })

  // 원작 문구가 "PRESS ANY KEY" 라 어떤 키든 받는다.
  useEffect(() => {
    const onKeyDown = () => pressRef.current()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { scene, press: () => pressRef.current() }
}
