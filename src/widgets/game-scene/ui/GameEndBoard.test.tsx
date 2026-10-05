// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('경기 끝 결과 판 (상태 0x18 경기 끝 가지)', () => {
  it('승·패·세 세 줄에 이름을 적고 없음(null)이면 비운다', () => {
    render(<GameEndBoard side0Score={2} side1Score={5} names={['김투수', '박투수', null]} onConfirm={() => {}} />)

    expect(screen.getByText('김투수')).toBeTruthy()
    expect(screen.getByText('박투수')).toBeTruthy()
    expect(screen.getByAltText('세이브')).toBeTruthy()
  })

  it('처음 10틱(0~9)은 OK 가 먹지 않고 틱 10 부터 정산으로 간다 (경기+0x32 = 틱 ≤ 9)', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<GameEndBoard side0Score={0} side1Score={1} names={[null, null, null]} onConfirm={onConfirm} />)

    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 9))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
