import { useEffect, useRef, useState } from 'react'
import { isGameSceneFrozen, setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'

/**
 * 경기 장면 상태의 **틱** (경기+0x2c) — 상태가 바뀐 틱이 0 이고 갱신마다 1 씩 오른다.
 *
 * 원본은 상태가 바뀐 틱에 진입 함수를 부르고(0x52c50 의 진입 표 0xd04bc), 그 다음부터 매 갱신이
 * 같은 상태의 갱신 함수를 부른다. 웹은 갱신 한 번을 경기 장면 틱 하나(`setGameSceneTickInterval` — 틱 머리마다)로 잡는다.
 *
 * `onTick` 은 **틱이 오를 때마다 한 번** 새 틱 값으로 불린다 — 원본 갱신 함수가 틱을 보고 하는 일
 * (효과음·굴림·나가기)을 거기서 한다. `isRunning` 이 거짓이면 멈춘다.
 *
 * 경기 장면 위에 공용 창 [0x140005c]+9 가 서 있으면 0x52c50 이 52cc6 에서 장면 틱 0xbc9c9(+0x2c +1) · 갱신 표 0xd0530 을
 * 건너뛰므로 틱이 안 오른다 — 창이 닫히면 건너뛴 갱신을 따라잡지 않고 이어 오른다(`isGameSceneFrozen`).
 * `runsUnderCommonWindow` 는 그 게이트 밖에서 늘 도는 그림(53064 의 기록 달성 알림 0x4e35c 따위)이 쓴다.
 */
export function useSceneTick(onTick?: (tick: number) => void, isRunning = true, runsUnderCommonWindow = false): number {
  const [tick, setTick] = useState(0)
  // 틱은 ref 로 센다 — setState 갱신 함수 안에서 `onTick` 을 부르면 StrictMode 가 두 번 불러
  // 굴림이 두 번 나간다
  const tickRef = useRef(0)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick
  const runsUnderCommonWindowRef = useRef(runsUnderCommonWindow)
  runsUnderCommonWindowRef.current = runsUnderCommonWindow

  useEffect(() => {
    if (!isRunning) return
    const handle = setGameSceneTickInterval(() => {
      if (!runsUnderCommonWindowRef.current && isGameSceneFrozen()) return
      tickRef.current += 1
      const next = tickRef.current
      setTick(next)
      onTickRef.current?.(next)
    })
    return () => handle()
  }, [isRunning])

  return tick
}

/** 원본 OK 키 — 확인(−5)·'5'. 웹은 Enter·Space 도 같은 키로 받는다 (MessageBox 와 같은 길) */
export function isOkKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === '5'
}
