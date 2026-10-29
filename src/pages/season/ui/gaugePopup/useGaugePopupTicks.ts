import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import { TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'

/**
 * **0x848d0 게이지 팝업의 갱신 셈** — 시즌 훈련(0xde) · 외출(0xe3) 연출이 같이 쓴다. 앱 틀마다 갱신 수를 세어 게이지 끝
 * (`TRAINING_POPUP_UPDATES`)이면 한 번만 `onFinished`. 확인 키(`isSkipKey`)나 누르기(돌려준 `skipRef`)는 게이지를 끝으로 건너뛴다 —
 * [gfx+0x1d0] = [gfx+0x1d8] 이라 0x84e58 이 끝을 본다(원본은 다음 갱신, 웹은 곧바로). `isSkipKey` 는 모듈 함수를 넘긴다.
 */
export function useGaugePopupTicks(isSkipKey: (key: string) => boolean, onFinished: () => void) {
  const [update, setUpdate] = useState(0)
  const skipRef = useRef<() => void>(() => undefined)
  const onFinishedLatest = useEffectEvent(onFinished)

  useEffect(() => {
    const startTick = appTickNow()
    let handle = 0
    let hasFinished = false
    const finish = () => {
      if (hasFinished) return
      hasFinished = true
      cancelAnimationFrame(handle)
      onFinishedLatest()
    }
    const tick = (now: number) => {
      const current = Math.max(0, appTickOf(now) - startTick)
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    skipRef.current = () => {
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSkipKey(event.key)) return
      event.preventDefault()
      skipRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      hasFinished = true
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isSkipKey])
  return [update, skipRef] as const
}
