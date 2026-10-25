// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import { setAutoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'
import { createMemoryAutoRelayRecordPort, setAutoRelayRecordPort } from '@/entities/mode-save/model/autoRelayRecord'

/**
 * **경기를 끝낸 재생 판의 실책이 정산에 든다** (r248 — 타자편 r244 의 팀 경기 짝).
 * 원본은 그 판을 0x17 로 다 그린 뒤 판정 B 0xae3e8 이 0xd → 경기 끝 판 0x18 → 정산 0x19 로 간다. 그리기 0x43278 이 실책 +0x2e 를 올린다.
 * 예전 화면은 요약이 서자마자 경기 끝 판을 띄워 재생이 잘리고 그 판 실책이 정산에서 빠졌다.
 *
 * 결정적으로 — 씨앗 고정 · 사람 타석 없는 설정(자동진행 중계로 끝까지)으로 경기를 끝내고, 끝난 진행의 재생 칸에 펌블(+0xb8 == 6)을 본
 * 야수 한 명이 든 판을 넣는다(`useTeamGame` 감싸기). 재생 화면은 그 판의 그린 실책을 넘기고 끝을 알리는 꼴로 바꿔 둔다.
 */
const 로딩판 = vi.hoisted(() => [] as string[])
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect } = await import('react')
  return {
    LoadingTip: ({ tip, onDone }: { tip: string; onDone: () => void }) => {
      useEffect(() => {
        로딩판.push(tip)
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    },
  }
})

/** 재생 화면 — 판 틱을 다 그린 실책을 판 끝(onDone 앞)에 넘긴다(`DefensePlayback` 재생 갈래와 같은 차례) */
const 재생기록 = vi.hoisted(() => [] as string[])
vi.mock('@/pages/defense/ui/DefensePlayback', async () => {
  const { useEffect } = await import('react')
  const { drawnReplayFieldingErrorsOf } = await import('@/features/defense-play/model/fieldingErrors')
  return {
    DefensePlayback: ({ ticks, onDone, onFieldingErrors }: {
      ticks?: readonly { readonly fielders: readonly { readonly slot: number }[] }[]
      onDone: () => void
      onFieldingErrors?: (errors: readonly unknown[]) => void
    }) => {
      useEffect(() => {
        if (ticks === undefined) return
        // 경기 끝 판이 이미 섰던가 — 섰으면 재생이 잘린 것이다
        재생기록.push(document.querySelector('[alt="승리투수"]') === null ? '재생' : '끝판 뒤 재생')
        const errors = drawnReplayFieldingErrorsOf(ticks)
        if (errors.length > 0) onFieldingErrors?.(errors)
        onDone()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <div data-testid="재생판" />
    },
  }
})

const 상대팀 = 1
/** 끝내기 재생 판 — 틱 하나, 상대 수비 칸 6 이 펌블 6 을 본다(0x4381a). 다른 칸은 판이 안 들고 온다 */
const 끝내기판 = {
  advance: { runs: 0, bases: [false, false, false], outsAdded: 0 },
  ticks: [{ ball: { x: 0, y: 0, z: 0 }, runners: [], fielders: [{ slot: 6, x: 0, y: 0, z: 0, teamIndex: 상대팀, fumbleTicks: 6 }] }],
  catchFielderSlot: 6,
  catchTick: 0,
  isUncatchable: false,
  caughtOnTheFly: false,
} as unknown as DefensePlayResult

vi.mock('@/pages/team-game/model/useTeamGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/team-game/model/useTeamGame')>()
  const injected = new WeakMap<object, object>()
  return {
    ...actual,
    useTeamGame: (...args: Parameters<typeof actual.useTeamGame>) => {
      const session = actual.useTeamGame(...args)
      if (!session.progress.game.isFinished) return session
      // 끝난 진행마다 같은 객체 — 재생 칸에 끝내기 판(실책은 진행기가 아니라 그림이 얹으니 요약은 진짜 진행에서 나온다)
      let progress = injected.get(session.progress) as typeof session.progress | undefined
      if (progress === undefined) {
        progress = { ...session.progress, lastDefensePlay: 끝내기판 }
        injected.set(session.progress, progress)
      }
      return { ...session, progress }
    },
  }
})

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 상대팀,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  // 사람이 한 타석도 안 잡는 설정 — 첫 타석부터 중계로 끝까지
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
}

const 흘리기 = (frames: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * frames))

beforeEach(() => {
  setAutoRelayRecordPort(createMemoryAutoRelayRecordPort())
  setAutoRelaySpeed(2)
  setActiveSound(createSilentSound())
  재생기록.length = 0
})
afterEach(() => {
  cleanup()
  setAutoRelayRecordPort(null)
  setActiveSound(null)
  vi.useRealTimers()
})

describe('팀 경기 — 경기를 끝낸 재생 판은 다 그린 뒤 경기 끝 판 · 정산 (0x17 → 0xd → 0x18 → 0x19, r248)', () => {
  it('재생이 먼저 서고, 그 판의 그린 실책이 정산 요약(leagueErrors)에 든다', () => {
    vi.useFakeTimers()
    const onSettlementEnter = vi.fn<(summary: TeamGameSummary) => void>()
    const onFinish = vi.fn<(summary: TeamGameSummary) => void>()
    render(
      <TeamGameScreen
        options={기본옵션}
        random={createSeededRandom(1)}
        onFinish={onFinish}
        onQuit={vi.fn()}
        onSettlementEnter={onSettlementEnter}
      />,
    )
    // 인트로 OK → 중계로 경기 끝까지
    fireEvent.keyDown(window, { key: 'Enter' })
    for (let 번 = 0; 번 < 4000 && 재생기록.length === 0 && screen.queryByAltText('승리투수') === null; 번 += 1) 흘리기(8)
    // 예전 화면은 요약이 서자마자 경기 끝 판 — 재생이 안 섰다
    expect(재생기록).toEqual(['재생'])
    // 재생 뒤 경기 끝 판 0x18
    흘리기(1)
    expect(screen.getByAltText('승리투수')).toBeTruthy()
    흘리기(10)
    fireEvent.keyDown(window, { key: 'Enter' })
    흘리기(1)
    expect(onSettlementEnter).toHaveBeenCalledTimes(1)
    const summary = onSettlementEnter.mock.calls[0]![0]
    expect(summary.leagueErrors).toHaveLength(1)
    expect(summary.leagueErrors?.[0]).toEqual(expect.objectContaining({ teamId: 상대팀 }))
  })
})
