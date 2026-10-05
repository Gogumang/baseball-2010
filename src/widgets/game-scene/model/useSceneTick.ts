import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 경기 장면 상태의 **틱** (경기+0x2c) — 상태가 바뀐 틱이 0 이고 갱신마다 1 씩 오른다.
 *
 * 원본은 상태가 바뀐 틱에 진입 함수를 부르고(0x52c50 의 진입 표 0xd04bc), 그 다음부터 매 갱신이
 * 같은 상태의 갱신 함수를 부른다. 웹은 갱신 한 번을 `millisecondsPerFrame()`(환경설정 [속도]) 로 잡는다.
 *
 * `onTick` 은 **틱이 오를 때마다 한 번** 새 틱 값으로 불린다 — 원본 갱신 함수가 틱을 보고 하는 일
 * (효과음·굴림·나가기)을 거기서 한다. `isRunning` 이 거짓이면 멈춘다.
 */
export function useSceneTick(onTick?: (tick: number) => void, isRunning = true): number {
  const [tick, setTick] = useState(0)
  // 틱은 ref 로 센다 — setState 갱신 함수 안에서 `onTick` 을 부르면 StrictMode 가 두 번 불러
  // 굴림이 두 번 나간다
  const tickRef = useRef(0)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  useEffect(() => {
    if (!isRunning) return
    const handle = window.setInterval(() => {
      tickRef.current += 1
      const next = tickRef.current
      setTick(next)
      onTickRef.current?.(next)
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [isRunning])

  return tick
}

/** 원본 OK 키 — 확인(−5)·'5'. 웹은 Enter·Space 도 같은 키로 받는다 (MessageBox 와 같은 길) */
export function isOkKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === '5'
}
