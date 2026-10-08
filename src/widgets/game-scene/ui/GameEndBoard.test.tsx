// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
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

  it('점수판 틀 0x41440(경기, 0, 3) — 경기 끝 판은 늘 그린다', () => {
    render(<GameEndBoard side0Score={0} side1Score={1} names={[null, null, null]}
      scoreboardSides={[{ team: 1, isComputer: true }, { team: 4, isComputer: false }]} onConfirm={() => {}} />)
    const frame = screen.getByTestId('점수판-틀')
    expect([frame.dataset.x, frame.dataset.y]).toEqual(['0', '3'])
  })
})

describe('경기 끝 판의 이닝별 점수판 0x41c18 (503d8)', () => {
  it('넘기면 (14, 252) 에 그리고 합은 경기 끝이라 8틱에 5틱(틱 mod 8 ≤ 4)만 보인다 · 지금 칸 테는 없다', () => {
    vi.useFakeTimers()
    const lineScore = {
      sideTeams: [2, 5] as const, inning: 8, offenseSide: 1 as const,
      inningRuns: [[0, 0, 0, 0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0, 0, 0, 3]] as const,
    }
    render(<GameEndBoard side0Score={2} side1Score={3} names={[null, null, null]} lineScore={lineScore} onConfirm={() => {}} />)
    const board = screen.getByTestId('이닝별점수판')
    expect([board.getAttribute('data-x'), board.getAttribute('data-y')]).toEqual(['14', '252'])
    expect(screen.getAllByTestId('이닝별점수판-합')).toHaveLength(2)
    expect(screen.queryByTestId('이닝별점수판-그림-33')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 5))
    expect(screen.queryAllByTestId('이닝별점수판-합')).toHaveLength(0)
  })

  it('안 넘기면 안 그린다', () => {
    render(<GameEndBoard side0Score={0} side1Score={1} names={[null, null, null]} onConfirm={() => {}} />)
    expect(screen.queryByTestId('이닝별점수판')).toBeNull()
  })
})

describe('공수 교대 판 (상태 0x18 교대 가지)', () => {
  it('점수판 틀 0x41440(경기, 0, 0) 은 틱 > 0x45 부터 (0x4ff00)', () => {
    vi.useFakeTimers()
    render(<HalfInningBoard inning={3} half="말" onConfirm={() => {}}
      scoreboardSides={[{ team: 1, isComputer: true }, { team: 4, isComputer: false }]} />)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 69))
    expect(screen.queryByTestId('점수판-틀')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('점수판-틀').dataset.y).toBe('0')
  })
})

describe('공수 교대 판의 두 팀 판 0x42364 · 0x420dc', () => {
  const cards = {
    battingSide: 1,
    count: { strikes: 0, balls: 0, outs: 0 },
    pitcherName: '김투수',
    currentOrder: 8,
    dueUpNames: ['구번', '일번', '이번'],
  }

  it('틱 > 0x45 부터 — 말이면 왼쪽(14)이 PITCHER · 오른쪽(150)이 DUE UP', () => {
    vi.useFakeTimers()
    render(<HalfInningBoard inning={1} half="말" cards={cards} onConfirm={() => {}} />)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 69))
    expect(screen.queryByTestId('교대판-투수')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('교대판-투수').dataset.x).toBe('14')
    expect(screen.getByTestId('교대판-타자').dataset.x).toBe('150')
    expect(screen.getByTestId('교대판-투수이름').textContent).toBe('김투수')
    expect([0, 1, 2].map((row) => screen.getByTestId(`교대판-타순-${row}`).dataset.order)).toEqual(['9', '1', '2'])
    expect(screen.getByTestId('교대판-타자이름-1').textContent).toBe('일번')
  })
})
