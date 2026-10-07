// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import type { RecordAlertOptions } from '@/widgets/game-scene/model/useRecordAlert'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const tick = (count = 1) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * count)
})

interface Props {
  readonly ids: readonly number[]
  readonly options: RecordAlertOptions
}

const rowsOf = (frame: ReturnType<typeof useRecordAlert>) => frame.rows.map((row) => row.slot)

describe('useRecordAlert — 칸 채우기 0x4e600 은 공 끝에만', () => {
  it('공 끝 번호가 안 바뀌면 줄에만 있다가 다음 공 끝에 칸에 든다 (자동진행 0x21 몫)', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 0 } } })
    tick()
    expect(result.current.panel).toBeNull()
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 1 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('공 끝 그림의 새 기록 가운데 앞쪽 몫만 넣고 뒤쪽(그 뒤 자동 타석)은 다음 공 끝까지 둔다', () => {
    const humanCountOf = (added: readonly number[]) => added.filter((id) => id >= 16).length
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, pitchEnd: { serial: 0, humanCountOf } } } as Props,
    })
    rerender({ ids: [16, 1], options: { isDrawing: true, pitchEnd: { serial: 1, humanCountOf } } })
    tick()
    expect(result.current.rows.map((row) => row.text)).toHaveLength(1)
    rerender({ ids: [16, 1], options: { isDrawing: true, pitchEnd: { serial: 2, humanCountOf } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0, 1])
  })

  it('정산 여부는 그 공 앞 상태 — 마지막 공 몫은 뜨고, 경기가 끝난 뒤 공 끝은 줄을 둔다', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [], options: { isDrawing: true, isSettled: false, pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [16], options: { isDrawing: true, isSettled: true, pitchEnd: { serial: 1 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
    rerender({ ids: [16, 28], options: { isDrawing: true, isSettled: true, pitchEnd: { serial: 2 } } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('처음 붙을 때의 기록은 `queuesInitialRecords` 면 줄에 넣어 첫 공 끝에 띄운다', () => {
    const { result, rerender } = renderHook(({ ids, options }: Props) => useRecordAlert(ids, options), {
      initialProps: { ids: [1], options: { isDrawing: true, pitchEnd: { serial: 0 }, queuesInitialRecords: true } } as Props,
    })
    tick()
    expect(result.current.panel).toBeNull()
    rerender({ ids: [1], options: { isDrawing: true, pitchEnd: { serial: 1 }, queuesInitialRecords: true } })
    tick()
    expect(rowsOf(result.current)).toEqual([0])
  })

  it('노랑 줄 틱 [+0x2c] — 장면 상태가 바뀐 첫 그림이 0, 팝업 동안은 그대로', () => {
    const options = (key: string, isFrozen = false): RecordAlertOptions => ({
      isDrawing: true, isFrozen, sceneStateKey: key, pitchEnd: { serial: 1 },
    })
    const { result, rerender } = renderHook(({ ids, options: current }: Props) => useRecordAlert(ids, current), {
      initialProps: { ids: [], options: { isDrawing: true, sceneStateKey: 'a', pitchEnd: { serial: 0 } } } as Props,
    })
    rerender({ ids: [1, 2], options: options('a') })
    // 틱 1..5 → (틱 % 18) / 6 = 0, 틱 6 → 1
    tick(6)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([false, true])
    rerender({ ids: [1, 2], options: options('b') })
    tick()
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false])
    rerender({ ids: [1, 2], options: options('b', true) })
    tick(10)
    expect(result.current.rows.map((row) => row.isHighlighted)).toEqual([true, false])
  })
})
