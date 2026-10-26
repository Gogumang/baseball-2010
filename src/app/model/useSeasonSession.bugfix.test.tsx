// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_PLAYABLE_EVENTS } from '@/entities/season-mode/model/seasonEventFlow'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'

beforeAll(() => setActiveSound(createSilentSound()))
afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

function 메모리저장(): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

type 세션결과 = { readonly current: ReturnType<typeof useSeasonSession> }

const 띄우기 = (store: JsonStorePort, seed = 20100901) => renderHook(() => useSeasonSession(store, createSeededRandom(seed)))

function 이벤트넘기기(result: 세션결과, limit = 20): void {
  for (let guard = 0; guard < limit && result.current.scene === SEASON_SCENE_STATE.이벤트재생; guard += 1) {
    const playback = result.current.eventPlayback
    if (playback === null) break
    const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
    const rewards = (event?.commands ?? []).flatMap((command) => (command.op === 'reward' ? command.items : []))
    act(() => result.current.actions.finishSeasonEvent(rewards, [playback.eventId]))
  }
}

function 시작(result: 세션결과, teamId: number): void {
  act(() => result.current.actions.chooseTeam(teamId, '테스터'))
  이벤트넘기기(result)
}

const 요약 = (overrides: Partial<TeamGameSummary> = {}): TeamGameSummary => ({
  result: '승',
  won: true,
  ourScore: 5,
  opponentScore: 3,
  ourTeamId: 0,
  opponentTeamId: 1,
  inningsPlayed: 9,
  pitching: { hitsAllowed: 6, walksAllowed: 2, outsRecorded: 27, runsAllowed: 3, allowedBaserunner: true },
  leaguePlateAppearances: [],
  popularityCompleteGame: null,
  reputationCompleteGame: null,
  gameRecord: clearSeasonGameRecord(),
  ...overrides,
})

describe('B-07 이어할 때마다 관중 수입이 한 번 더 들어옴', () => {
  const 경기정보까지 = (store: JsonStorePort) => {
    const rendered = 띄우기(store)
    시작(rendered.result, 0)
    act(() => rendered.result.current.actions.openNextGame())
    act(() => rendered.result.current.actions.confirmNextGame())
    act(() => rendered.result.current.actions.choosePreGameAce(1))
    act(() => rendered.result.current.actions.choosePreGameAce(8))
    return rendered
  }

  it('고침: 이어하기는 소지금을 그대로 둔다 — 새 경기를 세울 때 한 번만 더한다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-07']))
    const store = 메모리저장()
    const { result } = 경기정보까지(store)
    const 앞 = result.current.state!.record
    act(() => result.current.actions.startPendingGame())
    const 셋업 = result.current.state!.record
    expect(셋업.money).toBe(앞.money + 셋업.lastIncome)
    act(() => result.current.actions.saveGameProgress(startTeamGame(result.current.gameOptions!, createSeededRandom(7))))
    act(() => result.current.actions.leaveGame())

    for (let round = 0; round < 2; round += 1) {
      const 다시 = 띄우기(store, 1)
      act(() => {
        다시.result.current.actions.resumeSavedGame()
      })
      expect(다시.result.current.scene).toBe(SEASON_SCENE_STATE.경기직전)
      expect(다시.result.current.state!.record.money).toBe(셋업.money)
      act(() => 다시.result.current.actions.leaveGame())
    }
  })
})

describe('B-29 0xe9 를 끄고 이어하면 평가가 다시 나옴', () => {
  it('고침: 0xe9 에서 끄고 이어하면 0xe9 는 다시 뜨되 구내매점은 한 번만 준다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-29']))
    const store = 메모리저장()
    const { result } = 띄우기(store)
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, storeGames: 2 }))
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    expect(result.current.state!.record.storeGames).toBe(1)

    const 다시 = 띄우기(store, 1)
    expect(다시.result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    expect(다시.result.current.state!.record.storeGames).toBe(1)
    expect(다시.result.current.incomeEvaluation?.storeExpired).toBe(false)
  })

  it('고침: 0xe9 확인 뒤(0xf1)에 끄고 이어하면 0xe9 를 다시 안 탄다 — 1경기째 뒤라 다음경기', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-29']))
    const store = 메모리저장()
    const { result } = 띄우기(store)
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    act(() => result.current.actions.confirmIncome(result.current.state!.record))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기뒤마무리)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.기본)
    expect(띄우기(store).result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('고침: 다음 경기 끝은 정산 표시를 다시 내린다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-29']))
    const { result } = 띄우기(메모리저장())
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, storeGames: 5 }))
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    expect(result.current.state!.record.incomeSettled).toBe(true)
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    act(() => result.current.actions.confirmDayResults())
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    expect(result.current.state!.record.incomeSettled).toBe(true)
    expect(result.current.state!.record.games).toBe(2)
    expect(result.current.state!.record.storeGames).toBe(3)
  })
})
