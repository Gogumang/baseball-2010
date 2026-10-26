// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { advancePostseason, EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, startPostseason } from '@/entities/league/model/league'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

function 메모리저장(held: PlayerCareer | null): SaveGamePort {
  let saved = held
  return {
    load: () => saved,
    save: (career) => {
      saved = career
    },
    clear: () => {
      saved = null
    },
  }
}

const 띄우기 = (saved: PlayerCareer) => {
  const saveGame = 메모리저장(saved)
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return { screen, setScreen, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
  })
  act(() => rendered.result.current.session.actions.continueSaved())
  return rendered
}

describe('B-05 포스트시즌 시리즈마다 연말 시상 사슬이 다시 나옴 (136 진입 0x10bb0)', () => {
  const 순서대로리그 = {
    ...EMPTY_LEAGUE,
    wins: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 40 - team),
    losses: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 5 + team),
  }
  // 준PO 3위(2) 대 4위(3) 2승 1패에서 내가(2) 이겨 시리즈를 끝냈다 — 다음 라운드(PO)가 막 열려 g = 0
  const 끝난준PO = advancePostseason({ ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [2, 1] }, 2)
  const 선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
    ...createCareer('포스트'),
    teamId: 2,
    gamesPlayed: 49,
    league: 순서대로리그,
    postseason: 끝난준PO,
    regularSeasonRewardTaken: true,
    seasonEndState: 128,
    ...overrides,
  })

  it('원본: 내 경기로 시리즈가 끝나면 136(392) 부터 사슬을 다시 돈다', () => {
    const rendered = 띄우기(선수())
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 392, context: '시즌' })
  })

  it('고침: 시리즈 끝은 128 대진으로 곧장 — 대진이 막 열린 45번째 경기 뒤는 그대로 사슬', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-05']))
    const rendered = 띄우기(선수())
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
    expect(rendered.result.current.session.career?.seasonEndState).toBe(128)

    const 첫날 = 띄우기(선수({ gamesPlayed: 45, postseason: startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) }))
    act(() => 첫날.result.current.session.actions.confirmGameResult())
    expect(첫날.result.current.screen).toEqual({ kind: '이벤트', eventId: 392, context: '시즌' })
  })

  it('고침: 경기 뒤(116)에 끊긴 옛 이어하기도 시리즈 끝이면 128 로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-05']))
    const rendered = 띄우기(선수({ seasonEndState: null, regularSeasonRewardTaken: false }))
    expect(rendered.result.current.screen.kind).toBe('포스트시즌')
  })
})

describe('B-28 116 이어하기가 경기 뒤 카운터를 다시 씀 (0x1c154 1c26a → 0x1278c)', () => {
  const 지난경기 = {
    summary: {
      result: '승' as const, ourScore: 5, opponentScore: 2,
      stats: { ...createCareer('x').stats, atBats: 4, hits: 2 },
      popularityPoints: 3, doublePlays: 0, scoringPositionOuts: 0,
      reputationCounts: { grandSlams: 0, walkOffs: 0, walks: 0, goAheadRuns: 0 },
      ourTeamId: 0, opponentTeamId: 1, recordIds: [],
    },
    evaluation: { popularityChange: 2, reputationChange: 3, moraleChange: 1, commentIndex: 40 },
  }
  const 평가중 = (): PlayerCareer => ({
    ...createCareer('평가'),
    gamesPlayed: 3,
    seasonEndState: 116,
    lastGame: 지난경기 as unknown as PlayerCareer['lastGame'],
    seasonPopularityGain: 10,
    reputation: 300,
    streaks: { multiHit: 5, homeRun: 0, hitless: 0 },
  })

  it('원본: 이어하면 +0x1c2 += +0x4a 를 한 번 더 한다', () => {
    expect(띄우기(평가중()).result.current.session.career?.seasonPopularityGain).toBe(12)
  })

  it('고침: 평가 창만 다시 띄우고 카운터는 그대로 — 연속 기록 보상은 [확인] 한 번', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-28']))
    const rendered = 띄우기(평가중())
    expect(rendered.result.current.screen.kind).toBe('경기평가')
    expect(rendered.result.current.session.career?.seasonPopularityGain).toBe(10)
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.session.career?.reputation).toBe(310)
  })
})

describe('B-26 행동한 뒤 흑백 외출 칸 취소 (0x13ba4)', () => {
  const 행동함 = (): PlayerCareer => ({
    ...createCareer('외출취소'), season: 3, seenEventIds: [String(451)], hasSeenYearGoalWindow: true, hasActedThisCycle: true,
  })
  const 지도에서취소 = async () => {
    const rendered = 띄우기(행동함())
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull(), { timeout: 5000 })
    act(() => rendered.result.current.setScreen({ kind: '관리' }))
    act(() => rendered.result.current.session.actions.runCommand('외출'))
    expect(rendered.result.current.screen).toEqual({ kind: '외출' })
    act(() => rendered.result.current.session.actions.leaveOutingMap())
    return rendered
  }

  it('원본: 지도에 들어갔다 취소하면 행동함이 내려간다', async () => {
    expect((await 지도에서취소()).result.current.session.career?.hasActedThisCycle).toBe(false)
  })

  it('고침: 들어설 때 행동했으면 그대로 남는다', async () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-26']))
    expect((await 지도에서취소()).result.current.session.career?.hasActedThisCycle).toBe(true)
  })
})
