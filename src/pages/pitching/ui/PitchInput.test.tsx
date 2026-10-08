// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import { PitchSlotPicker } from '@/pages/pitching/ui/PitchSlotPicker'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const 틱 = (n: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * n))
const 키 = (key: string, repeat = false) => fireEvent.keyDown(window, { key, repeat })
const C = ZONE_CENTERS[1]

describe('구질 고르기 0xf — 칸마다 정해진 키, 틱 8 뒤 넘김', () => {
  const 칸들 = [
    { slot: 0, name: 'FASTBALL' },
    { slot: 1, name: 'CURVE' },
    { slot: 5, name: '파이어 볼', isBlocked: true },
  ]

  it('키를 눌러도 틱 7 까지는 머물고, 틱 8 에 마지막으로 누른 칸으로 넘어간다', () => {
    const onDecide = vi.fn()
    render(<PitchSlotPicker choices={칸들} onDecide={onDecide} />)
    키('Enter')
    틱(3)
    키('2')
    틱(4)
    expect(onDecide).not.toHaveBeenCalled()
    틱(1)
    expect(onDecide.mock.calls).toEqual([[1]])
  })

  it('안 고르면 틱이 지나도 머문다', () => {
    const onDecide = vi.fn()
    render(<PitchSlotPicker choices={칸들} onDecide={onDecide} />)
    틱(30)
    expect(onDecide).not.toHaveBeenCalled()
  })

  it('막힌 마구 칸(0) · 빈 칸(6 → 칸 3) · 누르고 있는 반복은 버린다', () => {
    const onDecide = vi.fn()
    render(<PitchSlotPicker choices={칸들} onDecide={onDecide} />)
    키('0')
    키('6')
    키('2', true)
    틱(20)
    expect(onDecide).not.toHaveBeenCalled()
  })
})

describe('조준 0x10 — 흐르는 조준점', () => {
  const 조준점 = () => {
    const dot = screen.getByTestId('조준점')
    return { x: Number(dot.dataset.x), y: Number(dot.dataset.y), z: Number(dot.dataset.z) }
  }

  it('존 중심에서 시작하고, 방향키는 다른 키를 누를 때까지 틱마다 20 씩 흐른다', () => {
    render(<AimCursor side={1} onConfirm={vi.fn()} />)
    expect(조준점()).toEqual(C)
    키('ArrowUp')
    fireEvent.keyUp(window, { key: 'ArrowUp' })
    틱(3)
    // y 는 위로 · z 는 dy × 10 을 뺀다
    expect(조준점()).toEqual({ x: C.x, y: C.y + 60, z: C.z - 30 })
    키('0')
    틱(5)
    expect(조준점()).toEqual({ x: C.x, y: C.y + 60, z: C.z - 30 })
  })

  it('x ±600 · y ±400 · z ±200 에서 멈춘다', () => {
    render(<AimCursor side={1} onConfirm={vi.fn()} />)
    키('7')
    틱(100)
    expect(조준점()).toEqual({ x: C.x - 600, y: C.y - 400, z: C.z + 200 })
  })

  it('OK 는 그 틱까지 돈 조준점을 넘기고, CLR 은 취소를 부른다', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { unmount } = render(<AimCursor side={1} onConfirm={onConfirm} onCancel={onCancel} />)
    키('6')
    틱(2)
    키('5')
    expect(onConfirm.mock.calls).toEqual([[{ x: C.x + 40, y: C.y, z: C.z }]])
    unmount()

    render(<AimCursor side={1} onConfirm={onConfirm} onCancel={onCancel} />)
    키('Escape')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('게이지 0x11 — 누름은 칸만 정하고 틱 10 에 놓는다', () => {
  it('안 누르면 틱 10 에 칸 0 으로 놓는다', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    틱(9)
    expect(onRelease).not.toHaveBeenCalled()
    틱(1)
    expect(onRelease.mock.calls).toEqual([[0]])
  })

  it('커서 0 에서 누른 것은 무시되고 다시 누를 수 있다 — 정한 칸은 틱 10 에 넘어간다', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    키('Enter')
    틱(6)
    키('5')
    // 정한 뒤 누름은 같은 칸을 다시 적을 뿐이다
    틱(2)
    키('Enter')
    expect(screen.getByLabelText('투구 게이지 6칸')).toBeTruthy()
    expect(onRelease).not.toHaveBeenCalled()
    틱(2)
    expect(onRelease.mock.calls).toEqual([[6]])
  })
})
