// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AutoPlayRelayScreen } from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen'
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
