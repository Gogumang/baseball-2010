/** 공 무늬 바탕이 앱에 남기는 칸 — 그린 수 [skin+0x414] · 지금 그린 무늬(위 반투명 그림이 같은 틀에 다시 그린다) */
import { useLayoutEffect, useState } from 'react'

/**
 * 공 무늬를 그린 수 — [skin+0x414] 와 gpoint 애니 진행이 둘 다 스킨(앱에 하나)에 있어 화면을 건너 이어진다.
 * 0 으로 놓는 곳은 스킨을 만들 때(0x5390c) 뿐이다.
 */
export const ballPatternDraws = { value: 0 }

/** 그린 뒤 — 지난번 센 틱부터 이번 틱까지 그린 수를 올리고 센 틱을 적는다 */
export function countBallPatternDraws(lastDrawn: { tick: number }, tick: number): void {
  ballPatternDraws.value += Math.max(0, tick - lastDrawn.tick)
  lastDrawn.tick = tick
}

/** 지금 그린 공 무늬 — 카운터 [skin+0x414] · gpoint 애니 그림. 무늬가 없으면 null */
export interface BallPatternNow {
  readonly counter: number
  readonly frame: number
}

const ballPatternOwners = new Map<symbol, BallPatternNow>()
let ballPatternNow: BallPatternNow | null = null

/** 지금 그린 공 무늬 — 없으면 null */
export const currentBallPattern = (): BallPatternNow | null => ballPatternNow
export const ballPatternListeners = new Set<() => void>()

function setBallPattern(owner: symbol, now: BallPatternNow | null): void {
  if (now === null) ballPatternOwners.delete(owner)
  else ballPatternOwners.set(owner, now)
  ballPatternNow = [...ballPatternOwners.values()].at(-1) ?? null
  for (const listener of ballPatternListeners) listener()
}

/**
 * 무늬를 그린 커밋의 레이아웃 단계에서 알린다 — 위 반투명 그림이 **같은 틀**에 다시 그려 무늬와 한 틀도 어긋나지 않는다
 * (알림을 받는 쪽은 React 를 거치지 않고 캔버스를 곧바로 칠한다)
 */
export function usePublishBallPattern(counter: number, frame: number): void {
  const [owner] = useState(() => Symbol('공무늬'))
  useLayoutEffect(() => {
    setBallPattern(owner, { counter, frame })
  }, [owner, counter, frame])
  useLayoutEffect(() => () => setBallPattern(owner, null), [owner])
}
