import { useEffect } from 'react'
import { setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'
import { beginSceneCloudCountingSpan, sceneCloudFrameOf } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **구름 덮개 셈** (Q-08) — 이 훅이 서 있는 동안 경기 장면 틱마다 구름 셈 0x78448 을 센다(`sceneCloudClock` 머리말).
 * 원본에서 구름을 세지만 웹은 타석 위 덮개로 그리는 상태 — 교체 창 0xb · 돌발 제안 0x1b · 타석 위 돌발 결과 0x1d · 강판 감독 대사 0x23 —
 * 가 서 있는 동안 부른다. 아래 루프가 같은 틱을 세면 한 번만 든다. 공용 창이 서 있으면 장면 틱이 안 올라 안 센다.
 */
export function useSceneCloudCountingSpan(isActive = true): void {
  useEffect(() => {
    if (!isActive) return undefined
    const frameNow = () => sceneCloudFrameOf(performance.now())
    const span = beginSceneCloudCountingSpan(frameNow())
    const stop = setGameSceneTickInterval(() => span.countThrough(frameNow()))
    return () => {
      stop()
      span.end(frameNow())
    }
  }, [isActive])
}

/** 덮개 셈만 하는 빈 부품 — 덮개 곁에 놓는다 */
export function SceneCloudCountingSpan(): null {
  useSceneCloudCountingSpan()
  return null
}
