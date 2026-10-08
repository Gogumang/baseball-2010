// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  AutoPlayRelayScreen, OFFENSE_BAND, OFFENSE_TEAM_RIGHT, OFFENSE_TEXT_AT, RELAY_BOX, RELAY_CARDS_AT,
} from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const steps: MissionAutoRelayStep[] = [
  { inning: 5, offenseSide: 1, scores: [2, 1], line: '김타자 1루타' },
  { inning: 5, offenseSide: 1, scores: [2, 1], line: null },
  { inning: 6, offenseSide: 0, scores: [3, 1], line: '박타자 홈런!!!' },
]

/** 세션 대신 — 틱마다 다음 칸을 싣고, 다 돌면 다음 틱에 끝(0x18) */
function Driver({ onDone }: { readonly onDone: () => void }) {
  const [index, setIndex] = useState(-1)
  const [done, setDone] = useState(false)
  if (done) return null
  return (
    <AutoPlayRelayScreen
      step={steps[index] ?? null}
      onTick={() => {
        if (index + 1 >= steps.length) {
          setDone(true)
          onDone()
          return
        }
        setIndex(index + 1)
      }}
      sideTeams={[3, 7]}
      humanSide={1}
    />
  )
}

describe('자동진행 중계 화면 (상태 0x21, 미션 갈래)', () => {
  it('틱마다 한 칸 — 글이 없는 틱(교체 · sim+0xc4 = 0)은 칸을 안 그리고, 다 돌면 다음 틱에 0x18 로', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Driver onDone={onDone} />)

    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('중계-글').textContent).toBe('김타자 1루타')
    expect(screen.getByTestId('중계-공격팀').textContent).toContain('공격팀(PLAYER)')

    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.queryByTestId('중계-글')).toBeNull()

    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(screen.getByTestId('중계-글').textContent).toBe('박타자 홈런!!!')
    expect(screen.getByTestId('중계-공격팀').textContent).toContain('공격팀(COM)')
    expect(onDone).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(millisecondsPerFrame()))
    expect(onDone).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 3))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('틱마다 onTick 한 번 — 키를 안 받는다 (0x3e25c 는 모드 ∈ {1,2,8,9} 에서만, CLR 중단 · 속도 없음)', () => {
    vi.useFakeTimers()
    const onTick = vi.fn()
    render(<AutoPlayRelayScreen step={null} onTick={onTick} sideTeams={[3, 7]} humanSide={1} />)
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onTick).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 2))
    expect(onTick).toHaveBeenCalledTimes(2)
  })
})

describe('0x4258c 자리 — 기준 칸 game_ui 19 상자 4 (폭 212 · 높이 57)', () => {
  it('두 팀 판 PITCHER (8, 250) → DUE UP (156, 250) · 띠 (14, 72) · 띠 글 (19, 76) · 중계 칸 (58, 196, 124×18)', () => {
    expect(RELAY_CARDS_AT).toEqual({ pitcherX: 8, dueUpX: 156, y: 250 })
    expect(OFFENSE_BAND).toEqual({ x: 14, y: 72, width: 212, height: 18 })
    expect(OFFENSE_TEXT_AT).toEqual({ x: 19, y: 76 })
    expect(OFFENSE_TEAM_RIGHT).toBe(221)
    expect(RELAY_BOX).toEqual({ x: 58, y: 196, width: 124, height: 18 })
  })

  it('두 팀 판 값을 싣는다 — 경기 끝이면 DUE UP 세 줄을 안 그린다', () => {
    const cards = { pitcherName: '김투수', strikes: 1, balls: 2, outs: 1, currentOrder: 3, dueUpNames: ['가', '나', '다'], gameOver: false }
    const step: MissionAutoRelayStep = { inning: 2, offenseSide: 0, scores: [1, 0], line: '가 1루타', cards }
    const { rerender } = render(<AutoPlayRelayScreen step={step} onTick={() => {}} sideTeams={[3, 7]} humanSide={1} />)
    expect(screen.getByTestId('교대판-투수').getAttribute('data-x')).toBe('8')
    expect(screen.getByTestId('교대판-타자').getAttribute('data-x')).toBe('156')
    expect(screen.getByTestId('교대판-투수이름').textContent).toBe('김투수')
    expect(screen.getByTestId('교대판-타자이름-0').textContent).toBe('가')
    rerender(<AutoPlayRelayScreen step={{ ...step, cards: { ...cards, gameOver: true } }} onTick={() => {}} sideTeams={[3, 7]} humanSide={1} />)
    expect(screen.queryByTestId('교대판-타자이름-0')).toBeNull()
    expect(screen.getByTestId('교대판-투수이름').textContent).toBe('김투수')
  })
})

describe('점수판 0x41c18 (14, 10) — 틱 꼴의 이닝별 칸', () => {
  it('이닝별 칸이 있으면 점수판을 (14, 10) 에 그리고, 측 1 은 말일 때만 지금 이닝을 그린다', () => {
    const inningRuns = [[1, 0, 2, 0, 0, 0, 0, 0, 0], [0, 3, 0, 0, 0, 0, 0, 0, 0]] as const
    const step: MissionAutoRelayStep = { inning: 2, offenseSide: 0, scores: [3, 3], line: null, inningRuns }
    render(<AutoPlayRelayScreen step={step} onTick={() => {}} sideTeams={[3, 7]} humanSide={1} />)
    const board = screen.getByTestId('이닝별점수판')
    expect([board.getAttribute('data-x'), board.getAttribute('data-y')]).toEqual(['14', '10'])
    // 측 0: 1·0·2 세 칸, 측 1: 0·3 두 칸 (3회초라 측 1 의 3회는 안 그린다)
    expect(screen.getAllByTestId('이닝별점수판-점수').map((glyph) => glyph.getAttribute('data-image')))
      .toEqual(['1', '0', '2', '0', '3'])
    expect(screen.getByTestId('이닝별점수판-로고-1').getAttribute('src')).toBe('./sprites/team_logo_ini/007.png')
  })

  it('목록 꼴(이닝별 칸 없음)이면 점수판을 안 그린다', () => {
    render(<AutoPlayRelayScreen step={steps[0]!} onTick={() => {}} sideTeams={[3, 7]} humanSide={1} />)
    expect(screen.queryByTestId('이닝별점수판')).toBeNull()
  })
})

describe('0x42364 DUE UP 의 미션 타자 줄', () => {
  it('미션 타자 칸이면 넘긴 미션 타자 이름을 그린다 (0xb62c0 → 기록 +1)', () => {
    const cards = {
      pitcherName: '김투수', strikes: 0, balls: 0, outs: 0, currentOrder: 2,
      dueUpNames: ['가', null, '다'], dueUpIsMissionBatter: [false, true, false], gameOver: false,
    }
    const step: MissionAutoRelayStep = { inning: 2, offenseSide: 1, scores: [1, 0], line: null, cards }
    render(<AutoPlayRelayScreen step={step} onTick={() => {}} sideTeams={[3, 7]} humanSide={1} missionBatterName="나리" />)
    expect(screen.getByTestId('교대판-타자이름-1').textContent).toBe('나리')
    expect(screen.getByTestId('교대판-타자이름-0').textContent).toBe('가')
  })
})
