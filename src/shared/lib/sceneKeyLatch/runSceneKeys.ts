import { withFinally } from '@/shared/lib/safe/tryOr'
import type { SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/latchCore'

/** 받은 키를 처리하는 중인 깊이 (`isRunningSceneKeys`) */
let runningDepth = 0

/**
 * 지금 받은 키를 처리하는 중인가 — 키 자리(52d9e)에서 연 창은 그 틀의 갱신(52e14~)이 이미 게이트(52cc6)를 지나 한 번 더 돈다.
 * 키 자리 밖(칸이 없어 바로 처리)에서 열면 웹은 그 한 틀을 여는 자리에서 따로 돌린다(`useInGameMenuState`)
 */
export function isRunningSceneKeys(): boolean {
  return runningDepth > 0
}

/**
 * 장면 틱 `tick` 의 틀 머리에서 받은 키를 처리한다. `stateTick` 은 처리에 넘길 상태 틱(안 주면 `tick`) — 부품이 따로 세는
 * 상태 틱([장면+0x2c])을 보는 키(경기 끝 판의 입력 잠금 따위)가 쓴다
 */
export function runSceneKeys(latch: SceneKeyLatch, tick: number, stateTick: number = tick): void {
  const applies = latch.take(tick)
  if (applies.length === 0) return
  runningDepth += 1
  withFinally(
    () => {
      for (const apply of applies) apply(stateTick)
    },
    () => {
      runningDepth -= 1
    },
  )
}
