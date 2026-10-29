// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'

/** 타석 화면이 받은 칸 — 사람 타석(0xd 이후)의 BattingStage 만 shiftResetSerial 을 받는다 */
const 받은 = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/widgets/batting-stage/ui/BattingStage', () => ({
  BattingStage: (props: Record<string, unknown>) => {
    받은.push(props)
    return null
  },
}))
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect } = await import('react')
  return {
    LoadingTip: ({ onDone }: { onDone: () => void }) => {
      useEffect(() => {
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

afterEach(() => {
  cleanup()
  받은.length = 0
  vi.useRealTimers()
})

describe('팀 경기 사람 타석 → 좌우 이동은 0xd 진입 번호로만 지운다 (0x48d50 48f88, A-02)', () => {
  it('사람이 치는 BattingStage 에 0xd 진입 표지(`sceneDEntryMark`)를 shiftResetSerial 로 넘긴다', () => {
    vi.useFakeTimers()
    render(
      <TeamGameScreen
        options={{ mode: 2, ourTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_FIRST_BAT, season: { illness: 0, morale: 100, coach: -1 } }}
        random={createSeededRandom(20100901)}
        onFinish={vi.fn()}
        onQuit={vi.fn()}
      />,
    )
    // 경기 시작 인트로(0xc) · 1회초 판(0x18)을 OK 로 넘긴다
    for (let 번 = 0; 번 < 6; 번 += 1) {
      fireEvent.keyDown(window, { key: 'Enter' })
      act(() => vi.advanceTimersByTime(millisecondsPerFrame() * 4))
    }
    const 타석 = 받은.filter((props) => props.settlement === undefined)
    expect(타석.length).toBeGreaterThan(0)
    expect(타석.every((props) => typeof props.shiftResetSerial === 'number')).toBe(true)
  })
})
