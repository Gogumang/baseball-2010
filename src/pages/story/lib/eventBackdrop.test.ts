import { describe, expect, it } from 'vitest'
import {
  INITIAL_EVENT_BACKDROP, MANAGEMENT_PORTRAIT_BASE_Y, OUTING_MAP_PORTRAIT_BASE_Y, drawEventBackdrop, effectTimelineOf,
  effectorPhaseAt, isBlockingEffectId, lastEffectIdIn, portraitBaseYOf,
} from '@/pages/story/lib/eventBackdrop'
import type { EventCommand } from '@/shared/config/original/eventTypes'

describe('초상화 바닥 y — 0x7fbc4 끝 0x7fdee~0x7fe4c', () => {
  it('외출 지도(0x70 · 0x71)거나 효과 칠이면 H − 0x44 = 252, 그 밖은 mode_ui 프레임 10 박스 0 의 65 + 72 − 2 = 135', () => {
    expect(OUTING_MAP_PORTRAIT_BASE_Y).toBe(252)
    expect(MANAGEMENT_PORTRAIT_BASE_Y).toBe(135)
    expect(portraitBaseYOf(false, false)).toBe(135)
    expect(portraitBaseYOf(true, false)).toBe(252)
    expect(portraitBaseYOf(false, true)).toBe(252)
  })
})

describe('효과기 단계 — 그리기(0x8b5ac)가 보는 +0x10', () => {
  it('건 직후 시작 · 밝아짐/어두워짐은 9 번째 칠(프레임 8)이 끝을 세워 프레임 9 가 끝 · 흔들기는 프레임 6 이 세워 7 이 끝', () => {
    expect(effectorPhaseAt('검정에서밝아짐', 0)).toBe('시작')
    expect(effectorPhaseAt('검정에서밝아짐', 8)).toBe('도는중')
    expect(effectorPhaseAt('검정에서밝아짐', 9)).toBe('끝')
    expect(effectorPhaseAt('검정에서밝아짐', 10)).toBe('없음')
    expect(effectorPhaseAt('흔들기', 6)).toBe('도는중')
    expect(effectorPhaseAt('흔들기', 7)).toBe('끝')
    expect(effectorPhaseAt('흔들기', 8)).toBe('없음')
  })
})

describe('효과 칠 — 0x8b5ac 0x8b62e~0x8b714', () => {
  it('재생은 0x8a380 이 비운 값([+0x2c4] = 0xb · [+0x2c8] = −1)으로 시작해 칠하지 않는다', () => {
    expect(INITIAL_EVENT_BACKDROP).toEqual({ effectId: 0xb, fill: null })
    expect(drawEventBackdrop(INITIAL_EVENT_BACKDROP, '없음')).toEqual({
      state: INITIAL_EVENT_BACKDROP, fill: null, isEffectFill: false, resetsDialogue: false,
    })
  })

  it('id 6 · 7 이 끝난 그리기는 색을 검정 · 흰색으로 남기고 글 · 초상화 · 상자를 처음으로 돌린다', () => {
    const 검정 = drawEventBackdrop({ effectId: 6, fill: null }, '끝')
    expect(검정).toEqual({ state: { effectId: 6, fill: '검정' }, fill: '검정', isEffectFill: true, resetsDialogue: true })
    expect(drawEventBackdrop({ effectId: 7, fill: null }, '끝').fill).toBe('흰색')
    // 남은 색은 효과기가 없을 때도 틀마다 칠한다(0x8b69a)
    expect(drawEventBackdrop(검정.state, '없음')).toMatchObject({ fill: '검정', isEffectFill: true, resetsDialogue: false })
    expect(drawEventBackdrop(검정.state, '시작')).toMatchObject({ fill: '검정', isEffectFill: true })
  })

  it('id 4 · 5 가 끝나면 색을 걷는다(−1)', () => {
    expect(drawEventBackdrop({ effectId: 4, fill: '검정' }, '끝')).toEqual({
      state: { effectId: 4, fill: null }, fill: null, isEffectFill: false, resetsDialogue: false,
    })
    expect(drawEventBackdrop({ effectId: 5, fill: '흰색' }, '끝').state.fill).toBeNull()
  })

  it('도는 동안은 흔들기(2 · 3)만 남은 색을 칠한다 — 어두워짐 · 밝아짐이 돌면 칠도 효과 칠 인자도 없다(0x8b6f0)', () => {
    expect(drawEventBackdrop({ effectId: 3, fill: '검정' }, '도는중')).toMatchObject({ fill: '검정', isEffectFill: true })
    expect(drawEventBackdrop({ effectId: 2, fill: null }, '도는중')).toMatchObject({ fill: null, isEffectFill: false })
    expect(drawEventBackdrop({ effectId: 4, fill: '검정' }, '도는중')).toMatchObject({ fill: null, isEffectFill: false })
    expect(drawEventBackdrop({ effectId: 1, fill: '검정' }, '도는중')).toMatchObject({ fill: null, isEffectFill: false })
  })

  it('흔들기 끝은 색을 안 바꾼다', () => {
    expect(drawEventBackdrop({ effectId: 3, fill: '흰색' }, '끝')).toMatchObject({ state: { fill: '흰색' }, resetsDialogue: false })
  })

  it('[mgr+0x2c4] 는 마지막 명령 5 의 id 그대로 — 1~7 밖이어도 (0x8d456)', () => {
    const commands = [{ op: 'effect', id: 6 }, { op: 'say' }, { op: 'effect', id: 9 }] as unknown as EventCommand[]
    expect(lastEffectIdIn(commands)).toBe(9)
    expect(lastEffectIdIn([])).toBeNull()
  })
})

describe('명령 5 기다림 0x8b564 — id 4~7 은 효과기 끝까지 다음 명령을 막는다', () => {
  it('막는 id 는 0xf0 칸(4 · 5 · 6 · 7)뿐 — 1 · 10(0x402) · 2 · 3 · 8 · 9(0x30c)는 곧바로', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(isBlockingEffectId)).toEqual([4, 5, 6, 7])
  })

  it('막는 효과는 끝 그리기(프레임 9) 다음 틀(10)에 다음 명령 · 다음 효과를 돌린다 — 흔들기는 안 막는다', () => {
    const 명령 = (ids: readonly number[]) => ids.map((id) => ({ op: 'effect', id })) as unknown as EventCommand[]
    expect(effectTimelineOf(명령([6]))).toMatchObject({ releaseFrame: 10, entries: [{ id: 6, start: 0 }] })
    expect(effectTimelineOf(명령([6, 4]))).toMatchObject({
      releaseFrame: 20, entries: [{ id: 6, start: 0, kind: '검정에서밝아짐' }, { id: 4, start: 10, kind: '검게어두워짐' }],
    })
    expect(effectTimelineOf(명령([1])).entries).toEqual([
      { id: 1, kind: null, color: '검정', vibrationMilliseconds: 500, start: 0 },
    ])
  })

  it('멈추지 않는 명령도 하나에 한 틀 — 다음 명령은 다음 틀에 돈다 (0x8dac2 → 다음 0x8cf64)', () => {
    const 명령 = (ids: readonly number[]) => ids.map((id) => ({ op: 'effect', id })) as unknown as EventCommand[]
    expect(effectTimelineOf(명령([2, 3]))).toMatchObject({ releaseFrame: 2, entries: [{ id: 2, start: 0 }, { id: 3, start: 1 }] })
    expect(effectTimelineOf([{ op: 'sound', id: 52 }] as unknown as EventCommand[])).toEqual({ entries: [], releaseFrame: 1 })
    const 섞음 = [{ op: 'sound', id: 52 }, { op: 'reward', items: [] }, { op: 'effect', id: 6 }, { op: 'sound', id: 1 }]
    expect(effectTimelineOf(섞음 as unknown as EventCommand[])).toMatchObject({ releaseFrame: 2 + 10 + 1, entries: [{ id: 6, start: 2 }] })
    expect(effectTimelineOf([])).toEqual({ entries: [], releaseFrame: 0 })
  })
})
