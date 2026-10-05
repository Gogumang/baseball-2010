// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { rollTeamSetup, startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { swapWithStarter } from '@/entities/pitcher-career/model/pitcherRotation'
import { rollQuickStart } from '@/pages/general-mode/lib/quickStart'
import { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'

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

  it('재굴림(*)은 기록 굴림 뒤에 0x30f20 을 다시 돈다 (31290)', () => {
    const { result } = 빠른실행()
    const 따로 = createSeededRandom(씨앗)
    const 처음 = rollQuickStart(따로, 열림)
    rollTeamSetup(처음.acePitcherId, 처음.aceBatterId, 따로)
    act(() => result.current.actions.respin())
    const setup = rollQuickStart(따로, 열림)
    const 굴림 = rollTeamSetup(setup.acePitcherId, setup.aceBatterId, 따로)
    expect(result.current.flow.setup).toEqual(setup)
    expect(result.current.gameOptions.opponentAces).toEqual(굴림.opponentAces)
    expect(result.current.gameOptions.startingPitcherSlots).toEqual(굴림.startingPitcherSlots)
  })
})
