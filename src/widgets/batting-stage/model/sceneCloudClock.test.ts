import { afterEach, describe, expect, it } from 'vitest'
import { LOADING_CLOUD_CALLS } from '@/widgets/batting-stage/lib/stageScenery'
import {
  createCloudFrameCursor,
  observeSceneCloudFrame,
  resetSceneCloudClock,
  sceneCloudCallsNow,
  sceneScoreboardTickOf,
} from '@/widgets/batting-stage/model/sceneCloudClock'
import { markCommonWindowShown, markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { SCENE_STATE, markSceneStateEntries, resetSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'

afterEach(() => {
  resetSceneCloudClock()
  resetCommonWindowShownForTest()
  resetSceneStateEntries()
})

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

  it('그림이 틱을 건너뛴 사이에 단계가 바뀌면 상태 경계(장면 틱)로 가른다 — 0xf 틱 0 부터 · 0x11 틱 0 앞까지만 센다', () => {
    const cursor = createCloudFrameCursor()
    // 0x12 (세지 않음) — 그림 10 을 보고, 다음 그림 14 에서 '대기'. 0x12 끝 문턱 다음 틀 12 가 0xf 틱 0
    markSceneStateEntries({ tick: 5, state: SCENE_STATE.결과 }, { tick: 12, state: SCENE_STATE.선택 })
    const before = observeSceneCloudFrame(10, false, cursor)
    // 12 · 13 · 14 셋 (11 은 아직 0x12)
    expect(observeSceneCloudFrame(14, true, cursor)).toBe(before + 3)
    // 0x11 틱 0 이 30 — 그림 28 을 보고 다음 그림 32 에서 '투구중'. 29 만 더 센다
    markSceneStateEntries({ tick: 30, state: SCENE_STATE.투구 })
    const idle = observeSceneCloudFrame(28, true, cursor)
    expect(observeSceneCloudFrame(32, false, cursor)).toBe(idle + 1)
  })

  it('경계 칸이 없거나(결과 창 · 웹만의 덮개) 지금 단계와 안 맞으면 사이 틱을 모두 지금 단계로 센다', () => {
    const cursor = createCloudFrameCursor()
    const before = observeSceneCloudFrame(10, false, cursor)
    expect(observeSceneCloudFrame(14, true, cursor)).toBe(before + 4)
  })

  it('장면을 나가면 로딩 판 자리로 되돌린다', () => {
    observeSceneCloudFrame(0, true, createCloudFrameCursor())
    resetSceneCloudClock()
    expect(sceneCloudCallsNow()).toBe(LOADING_CLOUD_CALLS)
  })
})

describe('전광판 글자 자리 [구장+0x8c] — 배경 0x41230 을 그린 수', () => {
  it('처음 그린 틱이 0 이고, 창이 선 첫 그림([창+0x250])마다 배경을 한 번 더 그려 하나 더 센다', () => {
    expect(sceneScoreboardTickOf(40)).toBe(0)
    expect(sceneScoreboardTickOf(45)).toBe(5)
    const scene = markGameSceneUp()
    const window = markCommonWindowShown()
    expect(sceneScoreboardTickOf(45)).toBe(6)
    window()
    const next = markCommonWindowShown()
    next()
    expect(sceneScoreboardTickOf(47)).toBe(9)
    scene()
  })
})
