import { afterEach, describe, expect, it } from 'vitest'
import { LOADING_CLOUD_CALLS } from '@/widgets/batting-stage/lib/stageScenery'
import {
  createCloudFrameCursor,
  observeSceneCloudFrame,
  resetSceneCloudClock,
  sceneCloudCallsNow,
} from '@/widgets/batting-stage/model/sceneCloudClock'

afterEach(() => resetSceneCloudClock())

describe('경기 장면 구름 셈 — 구장 +0x1c~+0x28 (0x78448)', () => {
  it('로딩 판의 두 부름에서 시작하고 첫 그림이 세 번째 부름이다', () => {
    expect(sceneCloudCallsNow()).toBe(LOADING_CLOUD_CALLS)
    const cursor = createCloudFrameCursor()
    expect(observeSceneCloudFrame(100, true, cursor)).toBe(LOADING_CLOUD_CALLS + 1)
    expect(observeSceneCloudFrame(103, true, cursor)).toBe(LOADING_CLOUD_CALLS + 4)
  })

  it('세지 않는 상태(0x11 · 0x12 · 0x13 · 0x17)의 그림은 건너뛰고 다시 세는 상태에서 이어 센다', () => {
    const cursor = createCloudFrameCursor()
    observeSceneCloudFrame(0, true, cursor)
    observeSceneCloudFrame(5, false, cursor)
    expect(observeSceneCloudFrame(7, true, cursor)).toBe(LOADING_CLOUD_CALLS + 1 + 2)
  })

  it('새 고리의 첫 그림은 많아야 1 — 같은 그림을 다시 보면(두 번 세우기) 0', () => {
    const first = createCloudFrameCursor()
    observeSceneCloudFrame(10, true, first)
    const again = createCloudFrameCursor()
    expect(observeSceneCloudFrame(10, true, again)).toBe(LOADING_CLOUD_CALLS + 1)
    const later = createCloudFrameCursor()
    expect(observeSceneCloudFrame(50, true, later)).toBe(LOADING_CLOUD_CALLS + 2)
  })

  it('장면을 나가면 로딩 판 자리로 되돌린다', () => {
    observeSceneCloudFrame(0, true, createCloudFrameCursor())
    resetSceneCloudClock()
    expect(sceneCloudCallsNow()).toBe(LOADING_CLOUD_CALLS)
  })
})
