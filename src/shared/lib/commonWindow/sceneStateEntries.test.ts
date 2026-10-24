import { afterEach, describe, expect, it } from 'vitest'
import {
  SCENE_STATE,
  cancelSceneStateEntriesAfter,
  markSceneStateEntries,
  resetSceneStateEntries,
  sceneStateEntryAt,
} from '@/shared/lib/commonWindow/sceneStateEntries'

describe('경기 장면 상태가 선 장면 틱 (0xbc9c8 — 예약 다음 틀이 상태 틱 0)', () => {
  afterEach(() => resetSceneStateEntries())

  it('지금 틱 이하의 마지막 칸 — 앞날의 예약은 그 틱이 되어야 선다', () => {
    markSceneStateEntries({ tick: 10, state: SCENE_STATE.선택 }, { tick: 19, state: SCENE_STATE.조준 })
    expect(sceneStateEntryAt(9)).toBeNull()
    expect(sceneStateEntryAt(10)?.state).toBe(0xf)
    expect(sceneStateEntryAt(18)?.tick).toBe(10)
    expect(sceneStateEntryAt(19)?.state).toBe(0x10)
  })

  it('새로 적으면 그 틱 이후의 예약을 바꾼다 — 견제(0x10 틱 6)는 0x11 대신 0x17', () => {
    markSceneStateEntries(
      { tick: 10, state: SCENE_STATE.선택 },
      { tick: 19, state: SCENE_STATE.조준 },
      { tick: 26, state: SCENE_STATE.투구 },
    )
    markSceneStateEntries({ tick: 26, state: SCENE_STATE.인플레이 })
    expect(sceneStateEntryAt(30)?.state).toBe(0x17)
    expect(sceneStateEntryAt(20)?.state).toBe(0x10)
  })

  it('거두기는 그 부품이 적은 상태만 — 확인 대기의 0xe 는 남는다', () => {
    markSceneStateEntries({ tick: 5, state: SCENE_STATE.준비 }, { tick: 7, state: SCENE_STATE.확인 })
    markSceneStateEntries({ tick: 9, state: SCENE_STATE.선택 }, { tick: 18, state: SCENE_STATE.조준 })
    cancelSceneStateEntriesAfter(6, [SCENE_STATE.선택, SCENE_STATE.조준, SCENE_STATE.투구])
    expect(sceneStateEntryAt(20)).toEqual({ tick: 7, state: 0xe })
  })
})
