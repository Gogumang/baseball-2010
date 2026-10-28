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

  it('키 자리의 상태 틱 0~9 에 처리된 OK 는 먹지 않고 틱 10 부터 정산으로 간다 (경기+0x32 = 틱 ≤ 9 · 다음 틀 0xbc9c8 이 예약을 되돌림)', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<GameEndBoard side0Score={0} side1Score={1} names={[null, null, null]} onConfirm={onConfirm} />)

    // 틱 8 에 받은 OK — 틱 9 의 키 자리에서 처리되어 버려진다
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 8))
    fireEvent.keyDown(window, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).not.toHaveBeenCalled()

    // 틱 9 에 받은 OK — 받은 틀에는 아무 일 없고 틱 10 의 키 자리에서 정산으로
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: '5' })
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('점수판 틀 0x41440(경기, 0, 3) — 경기 끝 판은 늘 그린다', () => {
    render(
      <GameEndBoard
        side0Score={0}
        side1Score={1}
        names={[null, null, null]}
        scoreboardSides={[
          { team: 1, isComputer: true },
          { team: 4, isComputer: false },
        ]}
        onConfirm={() => {}}
      />,
    )
    const frame = screen.getByTestId('점수판-틀')
    expect([frame.dataset.x, frame.dataset.y]).toEqual(['0', '3'])
  })
})

describe('경기 끝 판의 이닝별 점수판 0x41c18 (503d8)', () => {
  it('넘기면 (14, 252) 에 그리고 합은 경기 끝이라 8틱에 5틱(틱 mod 8 ≤ 4)만 보인다 · 지금 칸 테는 없다', () => {
    vi.useFakeTimers()
    const lineScore = {
      sideTeams: [2, 5] as const,
      inning: 8,
      offenseSide: 1 as const,
      inningRuns: [
        [0, 0, 0, 0, 0, 0, 0, 0, 2],
        [0, 0, 0, 0, 0, 0, 0, 0, 3],
      ] as const,
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
    render(
      <HalfInningBoard
        inning={3}
        half="말"
        onConfirm={() => {}}
        scoreboardSides={[
          { team: 1, isComputer: true },
          { team: 4, isComputer: false },
        ]}
      />,
    )
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

describe('공수 교대 판의 운동장 전경 0x4fb8c', () => {
  const rolls = Array.from({ length: 9 }, () => ({ offenseSpeed: 300, scatterX: 50, scatterZ: 150, fielderSpeed: 300 }))

  it('판이 선 틱부터 바탕으로 18명을 그리고, 틱 100 뒤 카메라가 비춘 야수에 이름표를 단다', () => {
    vi.useFakeTimers()
    const names = ['투수', '포수', '일루', '이루', '삼루', '유격', '우익', '좌익', '중견']
    render(
      <HalfInningBoard
        inning={1}
        half="초"
        onConfirm={() => {}}
        field={{ input: { rolls, offenseSide: 0, previousFielders: null }, defenseTeam: 3, offenseTeam: 5, fielderNames: names }}
      />,
    )
    expect(screen.getByTestId('운동장-전경')).toBeTruthy()
    expect(screen.getAllByTestId(/^운동장-선수-/)).toHaveLength(18)
    expect(screen.queryByTestId('운동장-이름표')).toBeNull()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 101))
    // 틱 101 — 카메라가 이미 멈춰 있으면 표 0xd044c 칸 1 = 좌익(7)
    const tag = screen.getByTestId('운동장-이름표')
    expect(tag.dataset.slot).toBe('7')
    expect(tag.textContent).toBe('좌익')
  })
})

describe('OK 를 대신하는 투명 눌림 칸 (웹 전용)', () => {
  it('경기 끝 판은 10틱 동안 눌러도 안 넘어가고 그 뒤 누르면 넘어간다', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<GameEndBoard side0Score={0} side1Score={1} names={[null, null, null]} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 10))
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('교대 판은 누르면 다음 틀에 넘어간다 (잠금 없음)', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<HalfInningBoard inning={1} half="초" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
