// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { rollTeamSetup, startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { swapWithStarter } from '@/entities/pitcher-career/model/pitcherRotation'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  QUICK_RESPIN_TICKS, finishQuickRespin, rollQuickRespinTeams, rollQuickStart,
} from '@/pages/general-mode/lib/quickStart'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
import { liveGameInningIndex, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'

/**
 * 상태 22 진입 `0x314b0` → `0x30f20` — 원본은 경기 장면이 아니라 경기정보에 들어올 때 마선수 둘·선발 둘을 굴린다
 * (3158c · 재굴림 끝 31290). 그래서 경기정보·엔트리 편집(상태 23)·경기가 같은 팀을 본다.
 */

const 열림 = { openedAcePitcherIds: [0, 1, 2, 3, 4], openedAceBatterIds: [0, 1, 2, 3, 4] }
const 씨앗 = 20100901

const 빠른실행 = () => {
  const random = createSeededRandom(씨앗)
  return { random, ...renderHook(() => useGeneralMode({ random, isQuickStart: true, ...열림 })) }
}

describe('일반모드 0x30f20 굴림 넷은 상태 22 진입에서 돈다', () => {
  it('0x30f20 은 전역 경기 상태 +0x6b 를 0 으로 둔다 (0x310a8 → 0xb6814, liveGameState)', () => {
    setLiveGameInningIndex(7)
    빠른실행()

    expect(liveGameInningIndex()).toBe(0)
  })

  it('빠른실행 — 기록 굴림 바로 뒤에 0x30f20 넷이 돌고 경기 옵션이 그 값을 든다', () => {
    const { result } = 빠른실행()
    const 따로 = createSeededRandom(씨앗)
    const setup = rollQuickStart(따로, 열림)
    const 굴림 = rollTeamSetup(setup.acePitcherId, setup.aceBatterId, 따로)

    expect(result.current.flow.setup).toEqual(setup)
    expect(result.current.gameOptions.opponentAces).toEqual(굴림.opponentAces)
    expect(result.current.gameOptions.startingPitcherSlots).toEqual(굴림.startingPitcherSlots)
  })

  it('경기 결과·난수 차례가 예전(경기 시작에서 굴리던 것)과 같다 — 위치만 앞당겼다', () => {
    const { result, random } = 빠른실행()
    const 앞당김 = startTeamGame(result.current.gameOptions, random)

    const 예전난수 = createSeededRandom(씨앗)
    const setup = rollQuickStart(예전난수, 열림)
    const { opponentAces: _a, startingPitcherSlots: _s, ...예전옵션 } = result.current.gameOptions
    expect(setup).toEqual(result.current.flow.setup)
    const 예전 = startTeamGame(예전옵션, 예전난수)

    expect(앞당김.opponentAcePitcherIndex).toBe(예전.opponentAcePitcherIndex)
    expect(앞당김.opponentAceBatterIndex).toBe(예전.opponentAceBatterIndex)
    expect(앞당김.ourPitcherIndex).toBe(예전.ourPitcherIndex)
    expect(앞당김.opponentPitcherIndex).toBe(예전.opponentPitcherIndex)
    expect(앞당김.game).toEqual(예전.game)
    expect(random.next()).toBe(예전난수.next())
  })

  it('경기정보 CPU 칸에 굴린 선발·마선수가 나온다 (0xb51fd · 0xb56b5 · 0xb56e1)', () => {
    const { result } = 빠른실행()
    const { flow, cpuMatchInfo, gameOptions } = result.current
    const 상대선발 = gameOptions.startingPitcherSlots?.opponent ?? 0
    expect(cpuMatchInfo?.acePitcherId).toBe(gameOptions.opponentAces?.pitcher)
    expect(cpuMatchInfo?.aceBatterId).toBe(gameOptions.opponentAces?.batter)
    expect(cpuMatchInfo?.starterName).toBe(teamPitchers(flow.setup.aiTeamId)[상대선발]?.name)
    const 유저선발 = gameOptions.startingPitcherSlots?.ours ?? 0
    expect(result.current.userStarterName).toBe(teamPitchers(flow.setup.userTeamId)[유저선발]?.name)
  })

  it('CPU 엔트리(상태 23)는 0↔k 를 맞바꾼 투수와 AI 마선수를 보인다', () => {
    const { result } = 빠른실행()
    act(() => result.current.actions.openEntry(false))
    const { flow, gameOptions, entryEdit } = result.current
    const k = gameOptions.startingPitcherSlots?.opponent ?? 0
    const 표 = swapWithStarter(teamPitchers(flow.setup.aiTeamId).map((pitcher) => pitcher.name), k)
    expect(entryEdit?.lists.pitchers.slice(0, 8).map((row) => row.name)).toEqual(표)
    expect(entryEdit?.lists.pitchers[8]?.isAce).toBe(true)
    expect(entryEdit?.lists.batters[9]?.isAce).toBe(true)
  })

  it('유저 팀 투수 0번을 바꾸면 경기 선발도 그 투수다 — 고친 차례는 맞바꾸기 전 모양으로 넘어간다', () => {
    const { result, random } = 빠른실행()
    act(() => result.current.actions.openEntry(true))
    // 투수 탭: 0번 OK → 아래 → 1번 OK (두 줄 맞바꿈)
    for (const key of ['확인', '아래', '확인'] as const) act(() => result.current.actions.pressEntryKey(key))
    const 편집기선발 = result.current.entryEdit?.lists.pitchers[0]?.name

    const progress = startTeamGame(result.current.gameOptions, random)
    expect(result.current.gameOptions.ourEntryOrder).toBeDefined()
    expect(progress.ourPitcherEntry[progress.ourPitcherIndex]?.name).toBe(편집기선발)
    expect(result.current.userStarterName).toBe(편집기선발)
  })

  it('재굴림(*)은 20틱 동안 팀 둘만 굴리다 20틱째 선공·마선수 뒤에 0x30f20 을 다시 돈다 (0x311a8)', () => {
    vi.useFakeTimers()
    try {
      const { result } = 빠른실행()
      const 따로 = createSeededRandom(씨앗)
      const 처음 = rollQuickStart(따로, 열림)
      const 처음굴림 = rollTeamSetup(처음.acePitcherId, 처음.aceBatterId, 따로)
      const 처음선발 = result.current.userStarterName
      act(() => result.current.actions.respin())
      expect(result.current.isRespinning).toBe(true)

      for (let 틱 = 1; 틱 < QUICK_RESPIN_TICKS; 틱 += 1) {
        const 팀 = rollQuickRespinTeams(따로, 열림)
        act(() => { vi.advanceTimersByTime(millisecondsPerFrame()) })
        // 기록 +0 · +4 만 바뀐다 — 선공·구장·마선수와 0x30f20 이 세운 선발 줄은 그대로
        expect(result.current.flow.setup).toEqual({ ...처음, ...팀 })
        expect(result.current.userStarterName).toBe(처음선발)
        expect(result.current.gameOptions.startingPitcherSlots).toEqual(처음굴림.startingPitcherSlots)
      }
      const setup = finishQuickRespin(따로, result.current.flow.setup, 열림)
      const 굴림 = rollTeamSetup(setup.acePitcherId, setup.aceBatterId, 따로)
      act(() => { vi.advanceTimersByTime(millisecondsPerFrame()) })

      expect(result.current.isRespinning).toBe(false)
      expect(result.current.flow.setup).toEqual(setup)
      // ⚠️ 원본 그대로 — 재굴림은 구장(+0xc)을 안 바꾼다
      expect(result.current.flow.setup.stadiumId).toBe(처음.stadiumId)
      expect(result.current.gameOptions.opponentAces).toEqual(굴림.opponentAces)
      expect(result.current.gameOptions.startingPitcherSlots).toEqual(굴림.startingPitcherSlots)
    } finally {
      vi.useRealTimers()
    }
  })

  it('재굴림이 도는 동안은 키를 안 받는다 — 시작·설정·엔트리·CLR·다시 * (0x312b6)', () => {
    vi.useFakeTimers()
    try {
      const { result } = 빠른실행()
      act(() => result.current.actions.respin())
      act(() => { vi.advanceTimersByTime(millisecondsPerFrame()) })
      act(() => {
        result.current.actions.start()
        result.current.actions.openSettings()
        result.current.actions.openEntry(true)
      })
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.isSettingsOpen).toBe(false)
      expect(result.current.entryEdit).toBeNull()
      let 처리됨 = false
      act(() => { 처리됨 = result.current.actions.back() })
      expect(처리됨).toBe(true)
      for (let 틱 = 2; 틱 <= QUICK_RESPIN_TICKS; 틱 += 1) act(() => { vi.advanceTimersByTime(millisecondsPerFrame()) })
      expect(result.current.isRespinning).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
