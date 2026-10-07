// @vitest-environment jsdom
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { EMPTY_LEAGUE, startPostseason } from '@/entities/league/model/league'
import { NO_EQUIPPED_TITLE, TITLE_NAMES } from '@/entities/career/model/titles'
import { createPitcherCareer, pitcherLastGameLineOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { pitcherEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers'
import { shopItemId } from '@/features/shop/model/shopSelection'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { rewardsIn } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { NariGameMatch, NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { startPitcherGame } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { nariLineupSlotsOf } from '@/entities/career/model/nariTeamRecord'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'

/** 나만의리그 투수편 한 판 (원본 모드 3, 장면 0x106) — 저장·장면 전환만 본다 */

function 메모리저장(): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

const 신인 = {
  role: PITCHER_ROLE.starter,
  typeIndex: 0,
  handIndex: 0,
  skinIndex: 0,
  breakingPitchSlots: [],
  teamId: 3,
}

const 띄우기 = (store: JsonStorePort = 메모리저장()) =>
  renderHook(() => usePitcherLeagueSession(store, createSeededRandom(20100901), false))

type 판 = ReturnType<typeof 띄우기>['result']

const 이벤트 = (id: number) => ORIGINAL_EVENTS.find((event) => event.id === id)!

/** r_event 본문은 따로 불러온다 — 자동 발동은 그 뒤부터 돈다 */
async function 이벤트불러오기(result: { current: { storyEvents: unknown } }) {
  await waitFor(() => expect(result.current.storyEvents).not.toBeNull())
}

/** 새 선수의 첫 105 — 오프닝 451(새 선수 플래그 0x1cfa6) → 연초 115 를 넘긴다 */
function 첫이벤트넘기기(result: 판) {
  for (let guard = 0; guard < 5; guard += 1) {
    const story = result.current.story
    if (result.current.scene !== '이벤트' || story === null) return
    if (story.eventId !== 451 && story.context !== '연초') return
    이벤트끝내기(result)
  }
}

/**
 * 재생기(StoryScreen)가 하는 일을 대신한다 — 지금 이벤트의 보상 명령을 모두 지나고, 선택지를 고르면
 * 그 이벤트로 이어 가 그 보상까지 모아 끝낸다 (`useEventPlayback` 의 onComplete 와 같은 꼴).
 */
function 이벤트끝내기(result: 판, ...고른것: number[]) {
  const story = result.current.story!
  const viewed = [story.eventId, ...고른것]
  const rewards: EventReward[] = viewed.flatMap((id) => rewardsIn(이벤트(id)?.commands ?? []))
  act(() => result.current.actions.completeStory(rewards, viewed))
  return viewed
}

/** 연말 사슬을 끝까지 돈다 — 선택지 이벤트는 `고르기` 가 고른 번호로 (380 → 383 수락이 기본) */
function 연말끝까지(result: 판, 고르기: Readonly<Record<number, readonly number[]>> = { 380: [383] }): number[] {
  const 본것: number[] = []
  for (let guard = 0; guard < 30 && result.current.scene === '이벤트' && result.current.story?.context === '연말'; guard += 1) {
    본것.push(...이벤트끝내기(result, ...(고르기[result.current.story.eventId] ?? [])))
  }
  return 본것
}

describe('투수편 세션', () => {
  it('커리어가 없으면 등록부터다', () => {
    const { result } = 띄우기()

    expect(result.current.career).toBeNull()
    expect(result.current.scene).toBe('등록')
  })

  it('등록하면 관리로 가고 고른 팀이 들어간다', () => {
    const { result } = 띄우기()

    act(() => result.current.actions.create('투수', 신인))

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.name).toBe('투수')
    expect(result.current.career?.teamId).toBe(3)
  })

  it('옛 저장의 컬렉터 해금은 불러올 때 보유에서 다시 센다 — 0x14a74 가 전역 표에 켜 둔 20 (isPitcherHiddenOpen 은 표만 본다)', () => {
    const store = 메모리저장()
    store.save({ ...createPitcherCareer('옛'), ownedEquipment: ['0-0', '0-1', '0-2', '0-3', '0-4', '0-5', '0-6'], openedHiddenIds: [] })
    expect(띄우기(store).result.current.career?.openedHiddenIds).toContain(20)
  })

  it('타자편과 **다른 저장 칸**을 쓴다 — 다시 띄우면 이어진다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.create('투수', 신인))

    const 둘째판 = 띄우기(store)

    expect(둘째판.result.current.career?.name).toBe('투수')
    expect(둘째판.result.current.scene).toBe('관리')
  })

  it('경기를 세우면 커리어에서 옵션 15칸이 채워진다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))

    act(() => result.current.actions.beginGame())

    expect(result.current.scene).toBe('경기')
    expect(result.current.gameOptions?.ourTeamId).toBe(3)
    expect(result.current.gameOptions?.role).toBe(PITCHER_ROLE.starter)
    // 환경설정 "투구 게이지" — 원본 기본값은 꺼짐이다 (K 5-2)
    expect(result.current.gameOptions?.gaugeSettingOn).toBe(false)
  })
})

/**
 * 시즌 끝(136 자리) → 연말(132) → 엔딩(141) 사슬.
 * 규칙은 `entities/pitcher-career/model/pitcherSeasonFlow.ts` 가 들고 있고 여기서는 **장면 전환**만 본다.
 */
describe('시즌 끝 → 연말 → 엔딩', () => {
  /** 경기 요약 — 세션이 보는 칸만 채운다 (`pitcherGameOptions.test.ts` 와 같은 꼴) */
  const 경기요약 = {
    result: '승',
    seasonDelta: { outs: 21, runsAllowed: 1, strikeouts: 5, pitches: 90, wins: 1, losses: 0, saves: 0 },
    stamina: 3000,
    pitchCount: 90,
    hasEntered: true,
    recordIds: [],
    record: { outsRecorded: 21 },
    evaluation: { popularityChange: 0, reputationChange: 0, moraleChange: 0, countedCompleteGame: '없음' },
  } as unknown as Parameters<ReturnType<typeof 띄우기>['result']['current']['actions']['finishGame']>[0]

  const 경기치르기 = (result: ReturnType<typeof 띄우기>['result']) => {
    act(() => result.current.actions.beginGame())
    act(() => result.current.actions.finishGame(경기요약))
    // 116 경기 뒤 평가 [확인] = 114
    expect(result.current.scene).toBe('경기결과')
    act(() => result.current.actions.confirmGameResult())
  }

  type 커리어 = Parameters<ReturnType<typeof 띄우기>['result']['current']['actions']['save']>[0]

  const 판짜기 = (career: Partial<커리어>) => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, ...career }))
    return result
  }

  it('경기 뒤 평가(0xa719c)는 정규시즌만 — 포스트시즌 경기는 0x4f268 이 건너뛴다, 45번째 경기는 평가된다', () => {
    const 평가요약 = { ...경기요약, evaluation: { popularityChange: 7, reputationChange: 3, moraleChange: -5, countedCompleteGame: '완봉' } } as typeof 경기요약
    const 정규 = 판짜기({ gamesPlayed: 44, popularity: 100, reputation: 100, morale: 50 })
    act(() => 정규.current.actions.beginGame())
    act(() => 정규.current.actions.finishGame(평가요약))
    expect(정규.current.career).toMatchObject({ popularity: 107, morale: 45 })
    // 선발형 승리 완봉 → +0x1f0[2] (평가 안이라 정규시즌만)
    expect(정규.current.career?.completeGameCounts).toEqual({ perfect: 0, noHitter: 0, shutout: 1, completeGame: 0 })
    expect(정규.current.career?.reputation).not.toBe(100)

    const 포스트 = 판짜기({
      gamesPlayed: 45,
      popularity: 100,
      reputation: 100,
      morale: 50,
      postseason: startPostseason([3, 0, 1, 2, 4, 5, 6, 7]),
    })
    act(() => 포스트.current.actions.beginGame())
    act(() => 포스트.current.actions.finishGame(평가요약))
    expect(포스트.current.career).toMatchObject({ popularity: 100, reputation: 100, morale: 50 })
    expect(포스트.current.career?.completeGameCounts.shutout).toBe(0)
  })

  it('경기 뒤 평가 116 의 0xa4d08 — 평판 0 으로 끝난 경기마다 +0x184 +1, 아니면 0 (칭호 30 이 본다)', () => {
    const 영 = 판짜기({ reputation: 0, reputationZeroGames: 4 })
    act(() => 영.current.actions.beginGame())
    act(() => 영.current.actions.finishGame(경기요약))
    expect(영.current.career?.reputationZeroGames).toBe(5)

    const 있음 = 판짜기({ reputation: 50, reputationZeroGames: 4 })
    act(() => 있음.current.actions.beginGame())
    act(() => 있음.current.actions.finishGame(경기요약))
    expect(있음.current.career?.reputationZeroGames).toBe(0)
  })

  it('경기 뒤 116 — S+0x50 = 2 · 기록 줄 · +0x1c2 += +0x4a, [확인]이 116 의 끝으로 가른다', () => {
    const 평가요약 = {
      ...경기요약,
      decisionCode: 1,
      record: { outsRecorded: 20, strikeouts: 6, runsAllowedField: 2 },
      evaluation: { popularityChange: 3, reputationChange: 0, moraleChange: 1, countedCompleteGame: '없음', managerCommentIndex: 9 },
    } as typeof 경기요약
    const result = 판짜기({ gamesPlayed: 4, seasonPopularityGain: 10 })
    act(() => result.current.actions.beginGame())
    act(() => result.current.actions.finishGame(평가요약))
    expect(result.current.scene).toBe('경기결과')
    const career = result.current.career!
    expect(career.seasonEndState).toBe(116)
    expect(career.seasonPopularityGain).toBe(13)
    expect(career.lastEvaluation).toEqual({ popularityChange: 3, reputationChange: 0, moraleChange: 1 })
    expect(career.lastGame).toMatchObject({ decisionCode: 1, outs: 20, strikeouts: 6, runs: 2 })
    expect(pitcherLastGameLineOf(career.lastGame!)).toBe('승리 6.2이닝 6삼진 2실점')
    act(() => result.current.actions.confirmGameResult())
    // g = 5 홀수 → [114 → 109]
    expect(result.current.scene).toBe('다음경기순위')
    expect(result.current.career?.seasonEndState).toBe(109)
  })

  it('연속 기록 +0x1bc — 정규시즌 평가가 잇고, 116 [확인](114)이 0x8a6fc 보상(평판)을 먹는다', () => {
    const 승리요약 = {
      ...경기요약,
      decisionCode: 1,
      endedInningIndex: 8,
      record: { outsRecorded: 27, strikeouts: 3, runsAllowedField: 0, walksAllowed: 0, hitByPitch: 0, hitsAllowed: 4 },
      evaluation: { popularityChange: 0, reputationChange: 0, moraleChange: 0, countedCompleteGame: '없음' },
    } as typeof 경기요약
    // 선발 · g = 4 (짝수, 선발 날) · 2연승 중
    const result = 판짜기({ gamesPlayed: 4, reputation: 100, streaks: { win: 2, strikeout: 0, loss: 0 } })
    act(() => result.current.actions.beginGame())
    act(() => result.current.actions.finishGame(승리요약))
    expect(result.current.career?.streaks).toEqual({ win: 3, strikeout: 0, loss: 0 })
    expect(result.current.career?.reputation).toBe(100)
    act(() => result.current.actions.confirmGameResult())
    // 3연승 → 표 0xd4ddc[0] = 5
    expect(result.current.career?.reputation).toBe(105)

    // 포스트시즌 경기는 평가가 건너뛰어 잇지 않는다
    const 포스트 = 판짜기({
      gamesPlayed: 45,
      streaks: { win: 1, strikeout: 0, loss: 0 },
      postseason: startPostseason([3, 0, 1, 2, 4, 5, 6, 7]),
    })
    act(() => 포스트.current.actions.beginGame())
    act(() => 포스트.current.actions.finishGame(승리요약))
    expect(포스트.current.career?.streaks).toEqual({ win: 1, strikeout: 0, loss: 0 })
  })

  it('포스트시즌 경기 뒤 116 은 S+0x1d8 기록 줄을 앞 평가 경기 값으로 다시 읽는다 (0xa719c 만 쓴다 · 0x4f268)', () => {
    const 앞줄 = { decisionCode: 2, outs: 18, runs: 4, strikeouts: 3, walksAndHitByPitch: 1, hitsAllowed: 9, pitches: 101, managerCommentIndex: 3 }
    const 포스트 = 판짜기({
      gamesPlayed: 45,
      lastGame: 앞줄,
      postseason: startPostseason([3, 0, 1, 2, 4, 5, 6, 7]),
    })
    act(() => 포스트.current.actions.beginGame())
    act(() => 포스트.current.actions.finishGame({
      ...경기요약,
      decisionCode: 1,
      record: { outsRecorded: 27, strikeouts: 9, runsAllowedField: 0, walksAllowed: 0, hitByPitch: 0, hitsAllowed: 2 },
    } as typeof 경기요약))
    expect(포스트.current.career?.lastGame).toMatchObject({
      decisionCode: 2, outs: 18, runs: 4, strikeouts: 3, walksAndHitByPitch: 1, hitsAllowed: 9, pitches: 101,
    })
  })

  it('이어하기 116 은 감독 글을 다시 고른다 — 38 은 전역 경기 상태 +0x6a == +0x6b(마지막 경기, 앱을 새로 켜면 0)로 (12ad8~12afe)', () => {
    const 구원116 = (career: object) => ({
      ...career,
      role: PITCHER_ROLE.relief,
      positionCode: 7,
      reputation: 100,
      seasonEndState: 116,
      lastEvaluation: { popularityChange: 1, reputationChange: 0, moraleChange: 0 },
      lastGame: { decisionCode: 0, outs: 0, runs: 0, strikeouts: 0, walksAndHitByPitch: 0, hitsAllowed: 0, pitches: 0, managerCommentIndex: 38 },
    })
    const 다시띄우기 = (career: object) => {
      const store = 메모리저장()
      store.save(career)
      return 띄우기(store).result
    }
    // 마지막 경기가 9회까지 갔다 → +0x6b = 8 ≠ 6 → 표에서 고른다 (평판 100 → 구간 0 · 구원형 등급 1 → 2 + 3)
    const 앞 = 판짜기({ gamesPlayed: 4 })
    act(() => 앞.current.actions.beginGame())
    act(() => 앞.current.actions.finishGame({ ...경기요약, endedInningIndex: 8 } as typeof 경기요약))
    expect(다시띄우기(구원116(앞.current.career!)).current.career?.lastGame?.managerCommentIndex).toBe(5)
    // 마지막 경기가 7회 콜드 → +0x6b = 6 → 38
    const 콜드 = 판짜기({ gamesPlayed: 4 })
    act(() => 콜드.current.actions.beginGame())
    act(() => 콜드.current.actions.finishGame({ ...경기요약, endedInningIndex: 6 } as typeof 경기요약))
    expect(다시띄우기(구원116(콜드.current.career!)).current.career?.lastGame?.managerCommentIndex).toBe(38)
  })

  it('이어하기 S+0x50 == 2 → 116 을 다시 띄우고 카운터가 겹쳐 쌓인다 (0x1c154 1c26a · 0x1278c)', () => {
    const 첫 = 판짜기({ gamesPlayed: 4, seasonPopularityGain: 10 })
    act(() => 첫.current.actions.beginGame())
    act(() => 첫.current.actions.finishGame({
      ...경기요약,
      evaluation: { ...경기요약.evaluation, popularityChange: 2 },
    } as typeof 경기요약))
    const 끊김 = 첫.current.career!
    expect(끊김.seasonPopularityGain).toBe(12)
    const 저장 = (career: object) => {
      const store = 메모리저장()
      store.save(career)
      return 띄우기(store).result
    }
    const result = 저장(끊김)
    expect(result.current.scene).toBe('경기결과')
    expect(result.current.career?.seasonPopularityGain).toBe(14)
    act(() => result.current.actions.confirmGameResult())
    expect(result.current.scene).toBe('다음경기순위')

    // 재료 없는 옛 저장은 예전처럼 116 의 끝으로
    const { lastGame: _없음, ...옛 } = 끊김
    expect(저장(옛).current.scene).toBe('다음경기순위')
  })

  /** 저장해 두고 다시 띄운다 — 장면 0x106 에 다시 들어오는 이어하기 (상태 100 진입 0x1c154) */
  const 이어하기 = (career: Partial<커리어>) => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.create('투수', 신인))
    act(() => 첫판.result.current.actions.save({ ...첫판.result.current.career!, ...career }))
    return 띄우기(store).result
  }

  it('이어하기 — 시즌 끝 사슬 136·130·131·132 면 그 상태의 이벤트(392·370·375·380)부터 다시 튼다 (S+0x50)', () => {
    expect(이어하기({ season: 2, gamesPlayed: 45, seasonEndState: 136 }).current.story).toEqual({
      eventId: 392, context: '연말', viewed: [],
    })
    expect(이어하기({ season: 2, gamesPlayed: 45, seasonEndState: 130 }).current.story?.eventId).toBe(370)
    const 엠브이피 = 이어하기({ season: 2, gamesPlayed: 45, seasonEndState: 131 })
    expect(엠브이피.current.scene).toBe('이벤트')
    expect(엠브이피.current.story?.eventId).toBe(375)
    const 연말 = 이어하기({ season: 2, gamesPlayed: 45, seasonEndState: 132 })
    expect(연말.current.story?.eventId).toBe(380)
    // 연봉 수락 → 새 시즌 0x1b768 이 S+0x50 을 벗어난다
    연말끝까지(연말)
    expect(연말.current.career?.seasonEndState).toBeNull()
    expect(연말.current.scene).toBe('관리')
  })

  it('이어하기 — 109 진입이 S+0x50 = 4 를 저장했으면 109 로 (이전 상태 1 이라 취소가 안 먹는다)', () => {
    const 순위 = 이어하기({ gamesPlayed: 4, seasonEndState: 109 })
    expect(순위.current.scene).toBe('다음경기순위')
    expect(순위.current.nextGameFromManagement).toBe(false)
    act(() => 순위.current.actions.cancelNextGameStandings())
    expect(순위.current.scene).toBe('다음경기순위')
    // g 홀수(경기 뒤 116 → 109 갈래)도 109
    expect(이어하기({ gamesPlayed: 5 }).current.scene).toBe('다음경기순위')
  })

  it('이어하기 — 128(0xf)이면 대진으로, 끝나면 앞 사슬 없이도 132(380)로 간다', () => {
    const 대진 = startPostseason([3, 0, 1, 2, 4, 5, 6, 7])
    const result = 이어하기({
      season: 2, gamesPlayed: 45, postseason: 대진, regularSeasonRewardTaken: true, seasonEndState: 128,
    })
    expect(result.current.scene).toBe('포스트시즌')
    expect(result.current.postseasonPopup).toBeNull()
    act(() => result.current.actions.save({ ...result.current.career!, postseason: { ...대진, round: '종료', champion: 5 } }))
    act(() => result.current.actions.pressPostseason())
    act(() => result.current.actions.closePostseasonPopup())
    expect(result.current.story).toMatchObject({ eventId: 380, context: '연말' })
    expect(result.current.career?.seasonEndState).toBe(132)

  })

  it('정규시즌 우승 팝업 0xb 닫힘 — 다른 편·시즌 저장 +0x7a 가 모두 0 보다 크면 0x29 오토봇 배트를 연다 (0x15b84)', () => {
    const 펼치기 = (other: number) => {
      const store = 메모리저장()
      const 첫판 = 띄우기(store)
      act(() => 첫판.result.current.actions.create('투수', 신인))
      const 내팀 = 첫판.result.current.career!.teamId
      const wins = EMPTY_LEAGUE.wins.map((_w, team) => (team === 내팀 ? 40 : 10))
      act(() => 첫판.result.current.actions.save({
        ...첫판.result.current.career!,
        season: 2, gamesPlayed: 45, regularSeasonFirstCount: 1, regularSeasonRewardTaken: false, seasonEndState: 128,
        league: { ...EMPTY_LEAGUE, wins },
        postseason: startPostseason([내팀, ...Array.from({ length: 9 }, (_v, i) => (i >= 내팀 ? i + 1 : i))]),
      }))
      const 다시 = renderHook(() => usePitcherLeagueSession(
        store, createSeededRandom(20100901), false, null, null, true, undefined, undefined,
        () => ({ otherLeagueFirstCount: other, seasonModeFirstCount: 1, globalOpenedHiddenIds: [] }),
      ))
      expect(다시.result.current.postseasonPopup).toEqual({ kind: '정규시즌우승' })
      act(() => 다시.result.current.actions.closePostseasonPopup())
      return 다시.result.current.career!.openedHiddenIds
    }
    expect(펼치기(1)).toContain(0x29)
    expect(펼치기(0)).not.toContain(0x29)
  })

  it('이어하기 — 45번째 경기 뒤(사슬 전)는 시즌 끝 화면, 정규시즌은 관리 화면', () => {
    const 대진 = startPostseason([3, 0, 1, 2, 4, 5, 6, 7])
    expect(이어하기({ gamesPlayed: 45, postseason: 대진 }).current.scene).toBe('시즌종료')
    expect(이어하기({ gamesPlayed: 12 }).current.scene).toBe('관리')
  })

  it('128 에 들어가면 S+0x50 = 0xf 를 적는다 — 131 뒤 진입과 포스트시즌 경기 뒤 진입', () => {
    const result = 판짜기({
      season: 2,
      gamesPlayed: 45,
      popularity: 300,
      postseason: startPostseason([3, 0, 1, 2, 4, 5, 6, 7]),
    })
    act(() => result.current.actions.beginYearEnd())
    expect(result.current.career?.seasonEndState).toBe(136)
    연말끝까지(result)
    expect(result.current.scene).toBe('포스트시즌')
    expect(result.current.career?.seasonEndState).toBe(128)
  })

  it('45경기째를 치르면 정규시즌이 닫히고 시즌종료 화면으로 간다 (0xb818c)', () => {
    const result = 판짜기({ gamesPlayed: 44 })

    경기치르기(result)

    expect(result.current.career?.gamesPlayed).toBe(45)
    expect(result.current.scene).toBe('시즌종료')
    // 정규시즌이 닫히면 포스트시즌 대진이 선다
    expect(result.current.career?.postseason).not.toBeNull()
  })

  it('131 뒤 128 포스트시즌 — 내 차례면 내가 선발로 던지고 결과 뒤 128 로, 시리즈가 끝난 경기 뒤는 136 사슬을 다시 돌고, 끝나면 우승 발표 → 132(380)', () => {
    const result = 판짜기({
      season: 2,
      gamesPlayed: 45,
      popularity: 300,
      postseason: startPostseason([3, 0, 1, 2, 4, 5, 6, 7]),
    })
    act(() => result.current.actions.beginYearEnd())
    const 본것 = 연말끝까지(result)
    expect([376, 377]).toContain(본것[본것.length - 1])
    expect(result.current.scene).toBe('포스트시즌')

    const 경기들: boolean[] = []
    let 다시돈사슬 = 0
    for (let guard = 0; guard < 80 && result.current.scene !== '이벤트'; guard += 1) {
      if (result.current.scene === '경기') {
        // 포스트시즌은 0xa4f60 이 −2(그대로) — 늘 내 투수가 선발이다
        경기들.push(result.current.gameOptions!.isPostseason)
        act(() => result.current.actions.finishGame(경기요약))
        act(() => result.current.actions.confirmGameResult())
        // 116 끝: 시리즈가 이어지면 128, 내 시리즈가 끝났으면(g == 0) 136 시즌 끝 사슬을 다시 돈다
        expect(['포스트시즌', '시즌종료']).toContain(result.current.scene)
        continue
      }
      if (result.current.scene === '시즌종료') {
        다시돈사슬 += 1
        act(() => result.current.actions.beginYearEnd())
        expect(result.current.story?.eventId).toBe(392)
        expect([376, 377]).toContain(연말끝까지(result).at(-1))
        expect(result.current.scene).toBe('포스트시즌')
        continue
      }
      if (result.current.scene === '경기준비') {
        // 128 내 차례 → 142 경기 준비 → 확인
        act(() => result.current.actions.confirmMatchPrepare())
        continue
      }
      if (result.current.postseasonPopup !== null) act(() => result.current.actions.closePostseasonPopup())
      else act(() => result.current.actions.pressPostseason())
    }

    expect(경기들.length).toBeGreaterThan(0)
    expect(경기들.every(Boolean)).toBe(true)
    // 1위(3)는 한국시리즈 하나만 치른다 — 그 시리즈가 끝난 경기 뒤 한 번
    expect(다시돈사슬).toBe(1)
    expect(result.current.career?.postseason?.round).toBe('종료')
    expect(result.current.story).toMatchObject({ eventId: 380, context: '연말' })
  })

  /**
   * 2경기 주기 — 상태 116 의 끝 `0x12b98~0x12bb2` 가 `S+0xb2`(경기 수)의 비트0 을 보고
   * 짝수면 105(관리), 홀수면 109(순위표 → 곧 다음 경기)로 간다. 모드 갈림이 없어
   * **투수편도 타자편과 같은 2경기 주기**다.
   */
  it('짝수 경기 뒤에만 관리 화면이 열린다 (0x12b98 — 2경기 주기)', () => {
    const 짝수 = 판짜기({ gamesPlayed: 9 })
    경기치르기(짝수)
    expect(짝수.current.career?.gamesPlayed).toBe(10)
    expect(짝수.current.scene).toBe('관리')

    const 홀수 = 판짜기({ gamesPlayed: 10 })
    경기치르기(홀수)
    expect(홀수.current.career?.gamesPlayed).toBe(11)
    // 홀수 경기 뒤는 109 순위표 — 이전 상태가 100 이라 취소가 안 먹고, 확인하면 경기다
    expect(홀수.current.scene).toBe('다음경기순위')
    expect(홀수.current.nextGameFromManagement).toBe(false)
    act(() => 홀수.current.actions.cancelNextGameStandings())
    expect(홀수.current.scene).toBe('다음경기순위')
    act(() => 홀수.current.actions.confirmNextGameStandings())
    expect(홀수.current.scene).toBe('경기준비')
    act(() => 홀수.current.actions.confirmMatchPrepare())
    expect(홀수.current.scene).toBe('경기')
    expect(홀수.current.gameOptions?.dayCounter).toBe(11)
  })

  it('142 경기 준비 — 마선수 넷은 장면마다 한 번, 취소는 109 (이전 142 라 취소가 안 먹는다)', () => {
    const result = 판짜기({ gamesPlayed: 4 })
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    expect(result.current.scene).toBe('경기준비')
    const 굴림 = result.current.matchAces
    expect(굴림).toMatchObject({ myBatter: 0, myPitcher: 0 })
    act(() => result.current.actions.cancelMatchPrepare())
    expect(result.current.scene).toBe('다음경기순위')
    expect(result.current.nextGameFromManagement).toBe(false)
    act(() => result.current.actions.confirmNextGameStandings())
    expect(result.current.matchAces).toBe(굴림)
    act(() => result.current.actions.confirmMatchPrepare())
    expect(result.current.scene).toBe('경기')
    // 굴린 넷이 경기 팀에 실린다 — 0xb88c8 · 0xb8870 (명부 투수 8번 · 명단 9번)
    expect(result.current.gameOptions?.aces).toMatchObject({
      ours: { batter: 굴림?.myBatter, pitcher: 굴림?.myPitcher },
      opponent: { batter: 굴림?.opponentBatter, pitcher: 굴림?.opponentPitcher },
    })
  })

  it('관리 [다음경기] → 109 순위표 — 취소는 105 로, 확인은 경기 (0x105f0)', () => {
    const result = 판짜기({ gamesPlayed: 4 })
    act(() => result.current.actions.openNextGameStandings())
    expect(result.current.scene).toBe('다음경기순위')
    expect(result.current.nextGameFromManagement).toBe(true)
    // 109 진입 0x10d8c 의 S+0x50 = 4
    expect(result.current.career?.seasonEndState).toBe(109)
    act(() => result.current.actions.cancelNextGameStandings())
    expect(result.current.scene).toBe('관리')
    // 105 진입 0x11990 의 S+0x50 = 3 (웹 null)
    expect(result.current.career?.seasonEndState).toBeNull()
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    act(() => result.current.actions.confirmMatchPrepare())
    expect(result.current.scene).toBe('경기')
  })

  it('1~6년차 연말은 392 부터 사슬을 돌고 380 수락(383) 뒤 새 시즌이다 — 짝수 연차라 국가대표 판정은 없다', () => {
    const result = 판짜기({ season: 2, gamesPlayed: 45, popularity: 300 })

    act(() => result.current.actions.beginYearEnd())
    expect(result.current.scene).toBe('이벤트')
    expect(result.current.story).toEqual({ eventId: 392, context: '연말', viewed: [] })

    const 본것 = 연말끝까지(result)

    // 136 392 → 393~396 · 130 370 → 371~374 · 131 375 → 376/377 · 132 380 → 383
    expect(본것[0]).toBe(392)
    expect(본것.slice(2, 3)).toEqual([370])
    expect(본것).toContain(375)
    expect(본것.slice(-2)).toEqual([380, 383])
    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(3)
    expect(result.current.career?.gamesPlayed).toBe(0)
  })

  it('380 의 %s 는 상승분·새 연봉 ×100 을 금액 서식(0x55cf4)으로 — 새 연봉 105 는 "1억500" (%03d)', () => {
    const result = 판짜기({ season: 2, gamesPlayed: 45, popularity: 300, popularityAtSeasonStart: 100, salary: 50 })

    // 상승분 = max(1, (300 − 100) / 4) = 50 → "5000" · 새 연봉 100 → "1억"
    expect(result.current.storyReplacementsFor(380)).toEqual(['5000', '1억'])
    expect(result.current.storyReplacementsFor(381)).toBeUndefined()

    act(() => result.current.actions.save({ ...result.current.career!, salary: 55 }))
    expect(result.current.storyReplacementsFor(380)).toEqual(['5000', '1억500'])
  })

  it('강경 요구(381)는 연봉 등급 k 로 384~387 중 하나를 더 보고 새 시즌이다', () => {
    const result = 판짜기({ season: 2, gamesPlayed: 45, popularity: 300 })
    act(() => result.current.actions.beginYearEnd())

    const 본것 = 연말끝까지(result, { 380: [381] })

    expect(본것.slice(-3, -1)).toEqual([380, 381])
    expect([384, 385, 386, 387]).toContain(본것.at(-1))
    expect(result.current.career?.season).toBe(3)
  })

  it('MVP 비트는 375 에 들어가기 전에 선다 (상태 131 → 0xa4d2c)', () => {
    const result = 판짜기({ season: 2, gamesPlayed: 45 })
    act(() => result.current.actions.beginYearEnd())
    while (result.current.story?.eventId !== 375) 이벤트끝내기(result)
    // 리그 기록이 비어 있어 1위가 아니다 — 판정은 했지만 비트는 서지 않는다 (376 으로 간다)
    이벤트끝내기(result)
    expect(result.current.story?.eventId).toBe(376)
  })

  it('홀수 해(연차idx 짝수) 연말 뒤에는 국가대표 판정 133 — 목표 4개 미만이면 462 탈락 → 새 시즌', () => {
    const result = 판짜기({ season: 3, gamesPlayed: 45 })
    act(() => result.current.actions.beginYearEnd())

    const 본것 = 연말끝까지(result)

    expect(본것.slice(-1)).toEqual([462])
    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(4)
  })

  it('국가대표 선발(461) → 거절(464)은 평판 −20 뒤 곧 새 시즌, 출전(463)은 국가대항전 134 로', () => {
    // 목표 단계 3 (표 그대로) 넷 이상 — 방어율 0(안 던짐)·실점 0 · 탈삼진·승·인기도는 크게
    const 잘함 = {
      season: 1,
      gamesPlayed: 45,
      popularity: 2000,
      popularityAtSeasonStart: 0,
      stats: { ...createPitcherCareer('x').stats, wins: 30, strikeouts: 300 },
    }
    const 거절 = 판짜기(잘함)
    act(() => 거절.current.actions.beginYearEnd())
    const 본것 = 연말끝까지(거절, { 380: [383], 461: [464] })
    expect(본것.slice(-2)).toEqual([461, 464])
    expect(거절.current.career?.season).toBe(2)
    expect(본것).toContain(383)
    expect(거절.current.storyNotice).toBe('')

    const 출전 = 판짜기(잘함)
    act(() => 출전.current.actions.beginYearEnd())
    연말끝까지(출전, { 380: [383], 461: [463] })
    expect(출전.current.scene).toBe('국가대항전')
    expect(출전.current.career?.season).toBe(1)
    expect(출전.current.storyNotice).toBe('')
    // 0xb521d — 대표팀 투수 배열 칸 k(내 칸, 선발 0)에 내 투수 복사본, 옛 0번은 맨 끝
    expect(출전.current.career?.nariCupTeams?.korea.pitchers).toEqual([-1, 1, 2, 3, 4, 5, 6, 7, 0])
    // 순위 화면 134 에 들어오는 것만으로 받는 칭호 8 "국가 대표" (0x1b92c) — 거절은 못 받는다
    expect(출전.current.career?.titleIds).toContain(TITLE_NAMES[8])
    expect(거절.current.career?.titleIds).not.toContain(TITLE_NAMES[8])
  })

  it('국가대항전 한 바퀴 — 135 → 142(대회 표) → 대표팀으로 던지고 → 134, 커리어 정산 없이 대회만 하루 넘긴다', () => {
    const 잘함 = {
      season: 1,
      gamesPlayed: 45,
      popularity: 2000,
      popularityAtSeasonStart: 0,
      stats: { ...createPitcherCareer('x').stats, wins: 30, strikeouts: 300 },
    }
    const result = 판짜기(잘함)
    act(() => result.current.actions.beginYearEnd())
    연말끝까지(result, { 380: [383], 461: [463] })
    const cup = result.current.cup!.cup
    const matchup = { myTeam: 10, opponent: 11 }
    act(() => result.current.actions.startCupGame(matchup, cup))
    expect(result.current.scene).toBe('경기준비')
    expect(result.current.cupMatch?.matchup).toEqual(matchup)
    // 취소(−16) → 135 순위부터
    act(() => result.current.actions.cancelMatchPrepare())
    expect(result.current.scene).toBe('국가대항전')
    expect(result.current.cup?.atStandings).toBe(true)
    act(() => result.current.actions.startCupGame(matchup, cup))
    act(() => result.current.actions.confirmMatchPrepare())
    expect(result.current.scene).toBe('경기')
    const options = result.current.gameOptions!
    expect(options).toMatchObject({
      ourTeamId: 10, opponentTeamId: 11, isNationalCup: true, isPostseason: false, dayCounter: 0, stamina: 10000, playerSide: 1,
      positionCode: 0,
    })
    expect(options.ourPitcherOrder?.[0]).toBe(8)
    const 앞 = { ...result.current.career!, hasActedThisCycle: true }
    act(() => result.current.actions.save(앞))
    // 3루타(0) 기록 하나 — 정산 4ebaa 의 기록 G 는 대회 경기에도 쌓인다
    act(() => result.current.actions.finishGame({ ...경기요약, result: '승', ourScore: 2, opponentScore: 0, recordIds: [0] } as typeof 경기요약))
    expect(result.current.scene).toBe('국가대항전')
    expect(result.current.cup?.cup.day).toBe(1)
    expect(result.current.cup?.cup.wins[0]).toBe(1)
    expect(result.current.career?.stats).toEqual(앞.stats)
    expect(result.current.career?.wins).toBe(앞.wins)
    expect(result.current.career?.gamesPlayed).toBe(앞.gamesPlayed)
    expect(result.current.career?.gamePoint).toBe(앞.gamePoint + recordGamePointsOf([0]))
    // 4f156 S+4 = 0
    expect(result.current.career?.hasActedThisCycle).toBe(false)
    // 다음 날 상대국 칸은 마스터에서 새로
    expect(result.current.career?.nariCupTeams?.opponentTeamId).toBe(12)

    act(() => result.current.actions.finishCup({
      reward: { messageId: 199, popularity: 20, reputation: 30, money: 20, gamePoint: 1000 },
      openedTeams: [10],
    } as never))
    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(2)
    expect(result.current.career?.openedHiddenIds).toContain(10)
  })

  it('국가대항전 무승부 — 0x4ea0c 4f09a 는 동점이면 선공(측 0) 승: 풀리그 대한민국(후공)은 패로 들어간다', () => {
    const 잘함 = {
      season: 1,
      gamesPlayed: 45,
      popularity: 2000,
      popularityAtSeasonStart: 0,
      stats: { ...createPitcherCareer('x').stats, wins: 30, strikeouts: 300 },
    }
    const result = 판짜기(잘함)
    act(() => result.current.actions.beginYearEnd())
    연말끝까지(result, { 380: [383], 461: [463] })
    act(() => result.current.actions.startCupGame({ myTeam: 10, opponent: 11 }, result.current.cup!.cup))
    act(() => result.current.actions.confirmMatchPrepare())
    act(() => result.current.actions.finishGame({ ...경기요약, result: '무', ourScore: 2, opponentScore: 2 } as typeof 경기요약))
    expect(result.current.cup?.cup.losses[0]).toBe(1)
    expect(result.current.cup?.cup.wins[1]).toBe(1)
  })

  it('국가대항전 저장 · 이어하기 — 463 끝(S+0x50 = 3 · S+0x12c) · 정산이 넘긴 대회가 저장에 들고, 새로 띄우면 134 · 곧장 경기는 그날 경기로', () => {
    const 잘함 = {
      season: 1,
      gamesPlayed: 45,
      popularity: 2000,
      popularityAtSeasonStart: 0,
      stats: { ...createPitcherCareer('x').stats, wins: 30, strikeouts: 300 },
    }
    const store = 메모리저장()
    const { result } = 띄우기(store)
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, ...잘함 }))
    act(() => result.current.actions.beginYearEnd())
    연말끝까지(result, { 380: [383], 461: [463] })
    expect(result.current.career?.nationalCup).toEqual(createNationalCup())
    expect(result.current.career?.seasonEndState).toBeNull()
    act(() => result.current.actions.startCupGame({ myTeam: 10, opponent: 11 }, result.current.cup!.cup))
    act(() => result.current.actions.confirmMatchPrepare())
    act(() => result.current.actions.finishGame({ ...경기요약, result: '승', ourScore: 3, opponentScore: 1 } as typeof 경기요약))
    const 저장된대회 = result.current.career!.nationalCup!
    expect(저장된대회.day).toBe(1)
    expect(저장된대회.wins[0]).toBe(1)

    const 다시 = 띄우기(store).result
    expect(다시.current.scene).toBe('국가대항전')
    expect(다시.current.cup).toEqual({ cup: 저장된대회, atStandings: false })
    act(() => 다시.current.actions.resumeInterruptedGame({ aces: null, isNationalCup: true }))
    expect(다시.current.scene).toBe('경기')
    // 둘째 날 — 대한민국 대 쿠바(12), 대회 날짜 1
    expect(다시.current.gameOptions).toMatchObject({ ourTeamId: 10, opponentTeamId: 12, isNationalCup: true, dayCounter: 1 })

    // 대회 끝 → 새 시즌 0x1b768 이 S+0x12c 를 내린다
    act(() => 다시.current.actions.finishCup({
      reward: { messageId: 0, popularity: 0, reputation: 0, money: 0, gamePoint: 0 },
      openedTeams: [10],
    } as never))
    expect(다시.current.career?.nationalCup).toBeUndefined()
  })

  it('7년차 인기도 499 이하면 연말 사슬 끝이 방출(501) → 엔딩(1)이다', () => {
    const result = 판짜기({ season: 7, gamesPlayed: 45, popularity: 400 })

    act(() => result.current.actions.beginYearEnd())
    const 본것 = 연말끝까지(result)

    expect(본것.at(-1)).toBe(501)
    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(1)
  })

  it('7~12년차 연말은 은퇴 선택(502) — "은퇴한다"(496) → "은퇴한다"(503) 면 엔딩으로 간다', () => {
    const result = 판짜기({ season: 9, gamesPlayed: 45, popularity: 1600, gamePoint: 0 })

    act(() => result.current.actions.beginYearEnd())
    const 본것 = 연말끝까지(result, { 502: [496, 503] })

    expect(본것.slice(-3)).toEqual([502, 496, 503])
    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(5)
    // 엔딩 보너스 0xcc40c[5] = 12000 G 를 띄울 때 준다 (0x1220c)
    expect(result.current.career?.gamePoint).toBe(12_000)
  })

  it('은퇴 선택에서 연봉협상(380)을 고르면 다음 연차로 이어진다', () => {
    const result = 판짜기({ season: 10, gamesPlayed: 45, popularity: 1600 })
    act(() => result.current.actions.beginYearEnd())

    연말끝까지(result, { 502: [380, 383] })

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(11)
  })

  it('502 갈림길 화면(연말)의 버튼도 같은 이벤트로 — 연봉협상 380 · 은퇴 496', () => {
    const result = 판짜기({ season: 10, gamesPlayed: 45, popularity: 1600 })
    act(() => result.current.actions.continueCareer())
    expect(result.current.story).toEqual({ eventId: 380, context: '연말', viewed: [502] })

    act(() => result.current.actions.retire())
    expect(result.current.story).toEqual({ eventId: 496, context: '연말', viewed: [502] })
  })

  it('마지막 해(13년차)는 연말이 반드시 엔딩이다 (은퇴식 504)', () => {
    const result = 판짜기({ season: 13, gamesPlayed: 45, popularity: 1600 })

    act(() => result.current.actions.beginYearEnd())
    const 본것 = 연말끝까지(result)

    expect(본것.at(-1)).toBe(504)
    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(5)
  })

  /**
   * 부상 엔딩은 **관리 화면 진입**(105, 0x11910 → 0x11b32)의 첫 줄이라 관리 화면이 열리는
   * 짝수 경기 뒤에만 굴러간다 — 그래서 9경기째에서 시작해 10경기로 맞춘다.
   */
  it('부상으로 20경기를 뛰면 관리 화면에 들어가며 부상 엔딩(0)이다 (B-7)', () => {
    const result = 판짜기({ gamesPlayed: 9, isInjured: true, injuredGamesPlayed: 19 })

    경기치르기(result)

    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(0)
    // 부상·방출 엔딩은 보너스가 없다
    expect(result.current.career?.gamePoint).toBe(0)
  })

  it('부상 엔딩은 5000 G포인트로 같은 시즌에 이어할 수 있다', () => {
    const result = 판짜기({ gamesPlayed: 10, isInjured: true, injuredGamesPlayed: 20, gamePoint: 6000, endingIndex: 0 })
    act(() => result.current.actions.goto('엔딩'))

    let 이어함 = false
    act(() => {
      이어함 = result.current.actions.continueAfterEnding()
    })

    expect(이어함).toBe(true)
    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.isInjured).toBe(false)
    expect(result.current.career?.gamePoint).toBe(1000)
  })

  it('G포인트가 모자라면 이어하지 못한다', () => {
    const result = 판짜기({ injuredGamesPlayed: 20, gamePoint: 4999, endingIndex: 0 })
    act(() => result.current.actions.goto('엔딩'))

    let 이어함 = true
    act(() => {
      이어함 = result.current.actions.continueAfterEnding()
    })

    expect(이어함).toBe(false)
    expect(result.current.scene).toBe('엔딩')
  })

  it('엔딩을 다 보면 선수가 지워지고 저장도 빈다 (145 틀 → 메인 메뉴)', () => {
    const store = 메모리저장()
    const { result } = 띄우기(store)
    act(() => result.current.actions.create('투수', 신인))

    act(() => result.current.actions.finishEnding())

    expect(result.current.career).toBeNull()
    expect(result.current.scene).toBe('등록')
    // 다시 띄워도 옛 선수가 살아나지 않는다
    expect(띄우기(store).result.current.career).toBeNull()
  })

  /**
   * r_event 30~33 — 관리 화면(105)에서만 통과하고(trigger 0), 보상 종류 6 이
   * `선수[0x204 + v] = 1`(0x8c5da~0x8c754) 로 히든 계열을 연다. v 가 곧 행 번호다.
   */
  describe('히든 변화구 오픈 이벤트 30~33', () => {
    it('관리 화면에서 조건을 채우면 이벤트 30 을 튼다 — 끝나면 보상 종류 6 이 계열을 연다 (30 → 행1)', async () => {
      const result = 판짜기({
        season: 5,
        gamesPlayed: 10,
        ability: { control: 200, velocity: 250, breaking: 300, stamina: 100 },
      })
      await 이벤트불러오기(result)
      첫이벤트넘기기(result)

      // 대사는 재생기가 보여 준다 — 끝나기 전에는 아직 닫혀 있다
      expect(result.current.scene).toBe('이벤트')
      expect(result.current.story).toEqual({ eventId: 30, context: '관리', viewed: [] })
      expect(result.current.career?.hiddenPitchRows[1]).toBe(false)

      이벤트끝내기(result)

      expect(result.current.scene).toBe('관리')
      expect(result.current.career?.hiddenPitchRows[1]).toBe(true)
      expect(result.current.career?.seenEventIds).toContain('30')
      // 조건을 덜 채운 31~33 은 아직 잠겨 있다
      expect(result.current.career?.hiddenPitchRows[2]).toBe(false)
      expect(result.current.career?.hiddenPitchRows[0]).toBe(false)
      expect(result.current.story).toBeNull()
    })

    it('조건을 채운 것이 여럿이면 하나씩 연달아 나온다 (A 3절)', async () => {
      const result = 판짜기({
        season: 7,
        gamesPlayed: 10,
        ability: { control: 300, velocity: 400, breaking: 600, stamina: 100 },
      })
      await 이벤트불러오기(result)
      첫이벤트넘기기(result)

      const 본것: number[] = []
      while (result.current.scene === '이벤트') 본것.push(...이벤트끝내기(result))

      expect(본것).toEqual([30, 31, 32])
      expect(result.current.career?.hiddenPitchRows).toEqual([false, true, true, true])
      // 451 은 새 선수 오프닝, 115 내장 이벤트는 본 표시를 남기지 않는다
      expect(result.current.career?.seenEventIds).toEqual(['451', '30', '31', '32'])
    })

    it('조건을 못 채우면 틀지 않는다', async () => {
      const result = 판짜기({
        season: 5,
        gamesPlayed: 10,
        ability: { control: 200, velocity: 250, breaking: 299, stamina: 100 },
      })
      await 이벤트불러오기(result)
      첫이벤트넘기기(result)

      expect(result.current.scene).toBe('관리')
      expect(result.current.career?.hiddenPitchRows).toEqual([false, false, false, false])
    })
  })

  /**
   * 117 중간평가 — 105 진입(0x11bda~0x11c0c)이 경기 수 22 이고 그 해 비트(0xa4280)가 꺼져 있으면 튼다.
   * 비트는 452~454 의 보상을 마칠 때 0x8cbaa 가 켠다.
   */
  describe('중간평가 117 (0x11e84)', () => {
    it('22경기 뒤 관리 화면에 들어오면 목표 단계 1 의 달성 수로 452~454 를 틀고, 끝나면 그 해 다시 안 튼다', async () => {
      const result = 판짜기({ gamesPlayed: 21, popularity: 100, reputation: 100, morale: 50 })
      await 이벤트불러오기(result)
      첫이벤트넘기기(result)
      경기치르기(result)

      expect(result.current.career?.gamesPlayed).toBe(22)
      expect(result.current.story?.context).toBe('중간평가')
      const eventId = result.current.story!.eventId
      expect([452, 453, 454]).toContain(eventId)
      expect(result.current.career?.lastMidSeasonGoalCount).toBeGreaterThanOrEqual(0)

      이벤트끝내기(result)

      expect(result.current.scene).toBe('관리')
      expect(result.current.career?.midSeasonEvaluatedYears).toEqual([0])
      // 다시 관리 화면에 들어와도 (같은 22경기) 또 틀지 않는다
      act(() => result.current.actions.goto('외출'))
      act(() => result.current.actions.goto('관리'))
      expect(result.current.scene).toBe('관리')
    })

    it('1년차에 다섯 개를 모두 이루면 칭호 1 "떠오르는 샛별" 을 준다 (0x11ee6)', async () => {
      const result = 판짜기({
        gamesPlayed: 22,
        popularity: 500,
        popularityAtSeasonStart: 0,
        stats: { ...createPitcherCareer('x').stats, wins: 30, strikeouts: 300 },
      })
      await 이벤트불러오기(result)
      첫이벤트넘기기(result)

      expect(result.current.story?.eventId).toBe(452)
      expect(result.current.career?.lastMidSeasonGoalCount).toBe(5)
      expect(result.current.career?.titleIds).toContain('떠오르는 샛별')
    })
  })
})

describe('자동 발동 (0x1cf9c → 0x8be80 → 0xadc70) · 연초 115', () => {
  it('새 선수의 첫 105 — 오프닝 451 → 연초 115(내장 이벤트) → trigger 0 이벤트를 파일 순서로 (1 → 34)', async () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, removedMinusSkillIds: [3] }))
    await 이벤트불러오기(result)

    const 본것: (number | string)[] = []
    for (let guard = 0; guard < 10 && result.current.scene === '이벤트'; guard += 1) {
      const story = result.current.story!
      본것.push(story.context === '연초' ? '연초' : story.eventId)
      if (story.context === '연초') expect(result.current.career?.removedMinusSkillIds).toEqual([])
      이벤트끝내기(result)
    }

    expect(본것).toEqual([451, '연초', 1, 34])
    expect(result.current.career?.hasSeenYearGoalWindow).toBe(true)
    // 내장 이벤트는 본 표시가 없다
    expect(result.current.career?.seenEventIds).toEqual(['451', '1', '34'])
  })

  it('외출 지도(112)에 들어오면 trigger 1 이벤트를 틀고 끝나면 지도로 돌아온다 (401 인기도 3000)', async () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    await 이벤트불러오기(result)
    첫이벤트넘기기(result)
    while (result.current.scene === '이벤트') 이벤트끝내기(result)
    act(() => result.current.actions.save({ ...result.current.career!, popularity: 3000 }))
    act(() => result.current.actions.openOuting())

    expect(result.current.story).toEqual({ eventId: 401, context: '지도', viewed: [] })
    이벤트끝내기(result)
    expect(result.current.scene).toBe('외출')
    expect(result.current.career?.seenEventIds).toContain('401')
    // 스킬 보상 4 (값 2 → 스킬 1)
    expect(result.current.career?.skillIds).toContain(1)
  })
})

describe('마선수 대결 (match → 투수 미션 team−1 → 140 결과 이벤트)', () => {
  it('대결로 나갔다가 이기면 resultEvents[0] 을 앞 이벤트가 모은 것과 함께 틀고, 끝나면 105 — 장소 끝 처리는 나갈 때 한 번', async () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    await 이벤트불러오기(result)
    첫이벤트넘기기(result)
    while (result.current.scene === '이벤트') 이벤트끝내기(result)
    act(() => result.current.actions.openOuting())
    act(() => result.current.actions.enterOutingPlace(OUTING_PLACES[0]))

    const 앞보상 = { rewards: [{ kind: 0, value: 5 }], viewedEventIds: [113] }
    act(() => result.current.actions.beginAceMatch({ op: 'match', team: 16, resultEvents: [114, 115] }, 앞보상))
    expect(result.current.scene).toBe('마선수대결')
    expect(result.current.aceMatch?.mission).toMatchObject({ side: '투수', id: 16 })
    // match(SYS 8)가 관리자에 끝남(1)을 돌려 0x1c014 의 장소 끝 처리가 이 자리에서 돈다 (0x8d904)
    expect(result.current.career?.hasActedThisCycle).toBe(true)
    expect(result.current.career?.outingsThisSeason).toBe(1)

    act(() => result.current.actions.finishAceMatch(true))
    expect(result.current.story).toEqual({ eventId: 114, context: '대결결과', viewed: [], carried: 앞보상 })

    const 인기도 = result.current.career!.popularity
    act(() => result.current.actions.completeStory(앞보상.rewards, [113, 114]))
    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.popularity).toBe(인기도 + 5)
    expect(result.current.career?.seenEventIds).toEqual(expect.arrayContaining(['113', '114']))
    // 140 결과 이벤트의 뒤 상태는 105 라 장소 끝 처리를 다시 하지 않는다
    expect(result.current.career?.hasActedThisCycle).toBe(true)
    expect(result.current.career?.outingsThisSeason).toBe(1)
  })

  it('지면 resultEvents[1]', async () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    await 이벤트불러오기(result)
    첫이벤트넘기기(result)
    while (result.current.scene === '이벤트') 이벤트끝내기(result)
    act(() => result.current.actions.openOuting())
    act(() => result.current.actions.enterOutingPlace(OUTING_PLACES[0]))
    act(() => result.current.actions.beginAceMatch({ op: 'match', team: 20, resultEvents: [124, 125] }, { rewards: [], viewedEventIds: [123] }))
    act(() => result.current.actions.finishAceMatch(false))
    expect(result.current.story?.eventId).toBe(125)
  })
})

describe('외출 [!] · [들어가기] (0x8cdc0 · 0x16c64 · 114)', () => {
  const 판짜기 = async (career: Record<string, unknown>) => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, ...career }))
    await 이벤트불러오기(result)
    첫이벤트넘기기(result)
    return result
  }

  it('[!] 는 대상 1·3 장소 이벤트가 있는 장소에만 — [들어가기] 는 그 이벤트를 틀고 끝나면 행동을 쓰고 105', async () => {
    // 1년차 13경기째 — 경기장(trigger 2) 230 (1년 13경기 ~) 이 선다
    const result = await 판짜기({ gamesPlayed: 12 })
    act(() => result.current.actions.openOuting())
    const 경기장 = OUTING_PLACES.find((place) => result.current.eventPlaceIds.has(place.id))!
    expect(경기장).toBeDefined()

    act(() => result.current.actions.enterOutingPlace(경기장))
    expect(result.current.story?.context).toBe('장소')
    const eventId = result.current.story!.eventId
    expect(eventId).toBeLessThan(440)

    이벤트끝내기(result)

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.hasActedThisCycle).toBe(true)
    expect(result.current.career?.outingsThisSeason).toBe(1)
    expect(result.current.career?.seenEventIds).toContain(String(eventId))
  })

  it('보상 종류 7(히든 오픈)은 0x62368 팝업 글을 띄운다 — 투수 id 19~34 는 [142] 투수편, 35~ 는 [143] 타자편', async () => {
    const result = await 판짜기({ gamesPlayed: 0 })
    act(() => result.current.actions.openOuting())
    act(() => result.current.actions.enterOutingPlace(OUTING_PLACES[0]))
    act(() => result.current.actions.completeStory([{ kind: 7, value: 19 }, { kind: 7, value: 43 }], [result.current.story!.eventId]))

    expect(result.current.career?.openedHiddenIds).toEqual([19, 43])
    expect(result.current.storyNotice).toMatch(/^히든 아이템 오픈!! \[.+\] 나만의리그 투수편에서 사용가능합니다!N히든 아이템 오픈!! \[.+\] 나만의리그 타자편에서 사용가능합니다$/)
  })

  it('이벤트가 없는 장소는 빈 장소 440+장소 — 행동을 안 쓰고 지도(113)로 돌아온다', async () => {
    const result = await 판짜기({ gamesPlayed: 0 })
    act(() => result.current.actions.openOuting())
    const 빈곳 = OUTING_PLACES.find((place) => !result.current.eventPlaceIds.has(place.id))!

    act(() => result.current.actions.enterOutingPlace(빈곳))
    expect(result.current.story?.eventId).toBe(439 + 빈곳.frame)

    이벤트끝내기(result)

    expect(result.current.scene).toBe('외출')
    expect(result.current.career?.hasActedThisCycle).toBe(false)
    expect(result.current.career?.outingsThisSeason).toBe(0)
  })
})

describe('옛 저장 불러오기', () => {
  it('커리어에 칸이 늘어도 **빠진 칸을 기본값으로 메운다**', () => {
    const store = 메모리저장()
    // 칸이 늘기 전에 저장된 모양 — selectedMagicNumber 같은 새 칸이 없다
    store.save({ name: '옛투수', teamId: 5 } as object)

    const { result } = 띄우기(store)

    expect(result.current.career?.name).toBe('옛투수')
    expect(result.current.career?.teamId).toBe(5)
    // 새 칸이 undefined 로 남지 않는다
    expect(result.current.career?.selectedMagicNumber).toBe(0)
    expect(result.current.career?.season).toBeGreaterThan(0)
  })

  it('칭호 칸(+0x1c4)이 없는 옛 저장도 −1 로 메워 장착 없음으로 시작한다', () => {
    const store = 메모리저장()
    // 칭호를 이미 몇 개 얻은 옛 저장 — 그때는 `equippedTitle` 칸 자체가 없었다
    store.save({ name: '옛투수', titleIds: ['이름 없는 신인', '닥터 K'] } as object)

    const { result } = 띄우기(store)

    expect(result.current.career?.titleIds).toEqual(['이름 없는 신인', '닥터 K'])
    expect(result.current.career?.equippedTitle).toBe(NO_EQUIPPED_TITLE)
  })

  /**
   * 장착 칸(+0x14)·슬롯 단계(+0x1c6)도 나중에 생긴 칸이다. 예전 웹엔 장착 창이 없었으니 장착은 획득 때의
   * 자동 장착뿐 — 타자편 저장과 같이 보유 목록을 얻은 차례대로 단계 0(상한 6)에서 다시 자동 장착해 세운다.
   */
  it('장착 칸이 없는 옛 저장은 보유 스킬을 얻은 차례대로 자동 장착해 세운다 (0xa4bd8 → 0xa4b04)', () => {
    const store = 메모리저장()
    // 플러스 0,8,1,6,7,9 (여섯) → 21 은 상한에 걸려 못 끼고, 마이너스 3·18 은 상한과 무관하게 낀다
    store.save({ name: '옛투수', skillIds: [0, 8, 3, 1, 6, 7, 9, 21, 18] } as object)

    const { result } = 띄우기(store)

    expect(result.current.career?.equippedSkillIds).toEqual([0, 8, 3, 1, 6, 7, 9, 18])
    expect(result.current.career?.skillSlotLevel).toBe(0)
  })

  it('저장한 장착 칸·슬롯 단계는 그대로 돌아온다', () => {
    const store = 메모리저장()
    store.save({ ...createPitcherCareer('저장'), skillIds: [0, 8, 6], equippedSkillIds: [0, 6], skillSlotLevel: 1 })

    expect(띄우기(store).result.current.career).toMatchObject({ equippedSkillIds: [0, 6], skillSlotLevel: 1 })
  })

  it('이름이 없는 값은 커리어로 보지 않는다', () => {
    const store = 메모리저장()
    store.save({ teamId: 1 } as object)

    expect(띄우기(store).result.current.career).toBeNull()
  })
})

/**
 * **G 지갑 다리** — 원본 G는 전역 기록 `mgr[+0x64]` 한 칸이라 모드·선수와 상관없이 하나다
 * (`entities/wallet/model/gamePointWallet.ts` 머리글에 디스어셈). 투수편도 같은 칸을 본다.
 */
describe('G 지갑 다리 (전역 mgr[+0x64])', () => {
  /** 지갑 저장 칸 — 여러 번 띄워도 값이 이어지게 바깥에 둔다 */
  const 지갑저장 = (시작G: number): JsonStorePort => {
    let 값: unknown = { gamePoint: 시작G }
    return {
      load: () => 값,
      save: (value) => {
        값 = value
      },
    }
  }

  /**
   * 투수 세션과 지갑을 같이 띄운다 — 실제 App 배선과 같은 모양이다.
   *
   * ⚠️ **`StrictMode` 로 띄운다.** `main.tsx` 가 그렇게 띄우는데, 그러면 고리가 붙었다 떼고 다시
   *    붙어 **한 번 더 돈다.** 그냥 띄우면 실제 브라우저에서만 나는 어긋남(지갑 1000 + 투수 1500
   *    이 2500 이 아니라 1500 이 되던 것)을 테스트가 못 잡는다.
   */
  const 지갑띄우기 = (pitcherStore: JsonStorePort, walletStore: JsonStorePort, mergeStore: JsonStorePort) =>
    renderHook(
      () => {
        const wallet = useGamePointWallet(walletStore)
        return {
          wallet,
          session: usePitcherLeagueSession(pitcherStore, createSeededRandom(20100901), false, wallet, mergeStore),
        }
      },
      { wrapper: StrictMode },
    )

  /** 옛 투수 저장 — G를 선수 안에 들고 있던 시절의 모양이다 */
  const 옛투수저장 = (gamePoint: number): JsonStorePort => {
    const store = 메모리저장()
    store.save({ name: '옛투수', teamId: 5, gamePoint } as object)
    return store
  }

  it('⚠️ 옛 투수 저장의 G는 지갑으로 이사한다 — 타자편 몫에 **더해진다**', () => {
    // 타자편에서 옮겨 온 1000 + 투수편 저장에 남아 있던 1500.
    // 원본은 한 칸이라 두 값이 따로 있을 수 없었고, 둘 다 0 에서 시작했으므로 합이 그 한 칸 값이다
    const rendered = 지갑띄우기(옛투수저장(1500), 지갑저장(1000), 메모리저장())

    expect(rendered.result.current.wallet.balance).toBe(2500)
    // 선수가 내보이는 값도 같은 값이다 — 관리 화면 뱃지·구질 훈련 가드가 이 칸을 본다
    expect(rendered.result.current.session.career?.gamePoint).toBe(2500)
  })

  it('⚠️ 이사는 **딱 한 번**이다 — 다시 띄워도 두 번 더해지지 않는다', () => {
    const pitcherStore = 옛투수저장(1500)
    const walletStore = 지갑저장(1000)
    const mergeStore = 메모리저장()
    지갑띄우기(pitcherStore, walletStore, mergeStore)

    const 둘째판 = 지갑띄우기(pitcherStore, walletStore, mergeStore)

    expect(둘째판.result.current.wallet.balance).toBe(2500)
    expect(둘째판.result.current.session.career?.gamePoint).toBe(2500)
  })

  it('이사를 마친 뒤에는 **지갑이 이긴다** — 저장에 남은 옛 값이 지갑을 되돌리지 않는다', () => {
    const mergeStore = 메모리저장()
    mergeStore.save({ merged: true })

    const rendered = 지갑띄우기(옛투수저장(1500), 지갑저장(1000), mergeStore)

    expect(rendered.result.current.wallet.balance).toBe(1000)
    expect(rendered.result.current.session.career?.gamePoint).toBe(1000)
  })

  it('선수 쪽에서 G가 움직이면(구질 훈련·엔딩 보너스) 지갑으로 옮겨 간다', () => {
    const mergeStore = 메모리저장()
    mergeStore.save({ merged: true })
    const rendered = 지갑띄우기(옛투수저장(0), 지갑저장(1000), mergeStore)

    // 구질 훈련 600 G 를 치른 꼴 — 화면이 계산해 돌려주는 자리(`actions.save`)다
    act(() =>
      rendered.result.current.session.actions.save({
        ...rendered.result.current.session.career!,
        gamePoint: rendered.result.current.session.career!.gamePoint - 600,
      }),
    )

    expect(rendered.result.current.wallet.balance).toBe(400)
    expect(rendered.result.current.session.career?.gamePoint).toBe(400)
  })

  it('투수 GP 아이템을 사면 지갑 G 가 줄고 효과가 저장에 든다 (0x14a74 kind 2 — 전역 G)', () => {
    const mergeStore = 메모리저장()
    mergeStore.save({ merged: true })
    const pitcherStore = 옛투수저장(0)
    const rendered = 지갑띄우기(pitcherStore, 지갑저장(1000), mergeStore)
    act(() => rendered.result.current.session.actions.save({ ...rendered.result.current.session.career!, morale: 50 }))

    act(() => rendered.result.current.session.actions.openShop('GP'))
    // 6 영지버섯 300 G — 사기 +40
    act(() => rendered.result.current.session.actions.purchase(shopItemId('GP', 6)))

    // 칸 6 은 알림 대신 상세 결과 창 (0x15030 → 0x872a1) — 알림 버퍼는 창 글로 바뀐다
    expect(rendered.result.current.session.shopNotice).toBe('')
    expect(rendered.result.current.session.shopGpDetail?.itemIndex).toBe(6)
    expect(rendered.result.current.session.shopGpDetail?.before.morale).toBe(50)
    act(() => rendered.result.current.session.actions.closeShopGpDetail())
    expect(rendered.result.current.session.shopGpDetail).toBeNull()
    expect(rendered.result.current.session.scene).toBe('상점')
    expect(rendered.result.current.wallet.balance).toBe(700)
    expect(rendered.result.current.session.career?.gamePoint).toBe(700)
    expect((pitcherStore.load() as { morale: number }).morale).toBe(90)
  })

  it('⚠️ `?무한G` 는 보여 주는 값과 판정이 **같은 값**을 본다 — 이사는 미루고 저장도 안 건드린다', () => {
    window.localStorage.setItem('compus-baseball/dev', '무한G')
    try {
      const pitcherStore = 옛투수저장(1500)
      const mergeStore = 메모리저장()
      const rendered = 지갑띄우기(pitcherStore, 지갑저장(1000), mergeStore)

      // 지갑도 선수도 99999 — 예전처럼 "99999 인데 G 부족" 으로 어긋날 자리가 없다
      expect(rendered.result.current.wallet.balance).toBe(99_999)
      expect(rendered.result.current.session.career?.gamePoint).toBe(99_999)
      // 표식이 서지 않아 스위치를 끄면 그때 이사한다. 저장의 옛 G도 그대로다
      expect(mergeStore.load()).toBeNull()
      expect((pitcherStore.load() as { gamePoint: number }).gamePoint).toBe(1500)
    } finally {
      window.localStorage.removeItem('compus-baseball/dev')
    }
  })

  it('지갑을 안 넘기면 예전처럼 커리어 칸 하나로 돈다 (기존 테스트 자리)', () => {
    const { result } = 띄우기(옛투수저장(1500))

    expect(result.current.career?.gamePoint).toBe(1500)
  })
})

describe('투수편 상점 — 장비(111 · 121) · 서브 · GP', () => {
  it('장비를 사면 소지금·장착 니블이 저장에 들어가고, 투수 그림 등급(0x79790)이 그 니블을 받는다', () => {
    const store = 메모리저장()
    const { result } = 띄우기(store)
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, money: 200_000, popularity: 999 }))

    act(() => result.current.actions.openShop('장착'))
    expect(result.current.scene).toBe('상점')
    expect(result.current.shopTab).toBe('장착')

    // 레벨 9 사신의 두건 = 히든 id 21 — 전역(기록연감)에서 열린 것을 얹어 판정한다
    act(() => result.current.actions.purchase(shopItemId('장착', 0, 9), [21]))

    const career = result.current.career!
    expect(result.current.shopNotice).toBe('[사신의 두건] 구매 완료')
    expect(career.money).toBe(50_000)
    expect(career.equipmentLevels.control).toBe(10)
    expect(career.openedHiddenIds).toContain(21)
    expect((store.load() as typeof career).equipmentLevels.control).toBe(10)
    expect(pitcherEquipmentOf(career.equipmentLevels)).toEqual({ head: 9, hand: -1, body: -1, leg: -1 })

    act(() => result.current.actions.goto('관리'))
    act(() => result.current.actions.openShop('착용'))
    expect(result.current.shopTab).toBe('착용')
    expect(result.current.shopNotice).toBe('')
  })

  it('서브 아이템을 사면 소지금이 줄고 보유가 저장에 든다 (0x14c8c) — 같은 칸을 또 사면 StrMODE[78]', () => {
    const store = 메모리저장()
    const { result } = 띄우기(store)
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, money: 20_000 }))

    act(() => result.current.actions.openShop('서브'))
    expect(result.current.shopTab).toBe('서브')
    act(() => result.current.actions.purchase(shopItemId('서브', 0)))

    expect(result.current.shopNotice).toBe('[표적판] 구매 완료')
    expect(result.current.career?.money).toBe(5_000)
    expect((store.load() as { subItemIds: number[] }).subItemIds).toEqual([0])

    act(() => result.current.actions.purchase(shopItemId('서브', 0)))
    expect(result.current.shopNotice).toBe('이미 가지고 있는 아이템입니다')
  })

  it('또또상품권은 **한 번만** 굴린다 — 알림과 저장이 같은 결과다', () => {
    let rolls = 0
    const 세는난수 = {
      next: () => {
        rolls += 1
        return 0
      },
      nextInRange: (minimum: number) => minimum,
      pick: <T,>(candidates: readonly T[]) => candidates[0],
    }
    const { result } = renderHook(() => usePitcherLeagueSession(메모리저장(), 세는난수, false))
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, gamePoint: 1000, money: 0 }))
    rolls = 0

    act(() => result.current.actions.purchase(shopItemId('GP', 5)))

    expect(rolls).toBe(1)
    // 굴림 0 → 1등 1억 (0xd80b1 · 0xd80a7)
    expect(result.current.shopNotice).toBe('1등 당첨!! [1억] 획득!')
    expect(result.current.career?.money).toBe(10_000)
    expect(result.current.career?.lotteryPurchases).toBe(1)
    expect(result.current.career?.lotteryFirstPrizes).toBe(1)
    expect(result.current.career?.gamePoint).toBe(700)
  })

  it('전역 해금이 없으면 히든 칸은 막힌다 — 커리어는 그대로', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, money: 200_000, popularity: 999 }))
    const before = result.current.career

    act(() => result.current.actions.purchase(shopItemId('장착', 0, 9)))

    expect(result.current.shopNotice).toBe('아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다')
    expect(result.current.career).toBe(before)
  })
})

describe('투수편 외출 (112 지도 · 113 장소 — 타자편과 같은 코드)', () => {
  it('[외출] 은 지도로 가고, 장소 기능은 효과를 저장한다 — 서브 아이템 외식회원증 +4', () => {
    const store = 메모리저장()
    const { result } = 띄우기(store)
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, morale: 50, money: 1000, subItemIds: [6] }))

    act(() => result.current.actions.openOuting())
    expect(result.current.scene).toBe('외출')

    act(() => result.current.actions.runOutingFunction('외식'))

    const saved = store.load() as { morale: number; money: number; hasActedThisCycle: boolean; outingsThisSeason: number }
    // 외식 사기 bfa55(25,31) + 외식회원증 4 → 79 이상 85 이하 · 소지금 −100(만원)
    expect(saved.morale).toBeGreaterThanOrEqual(79)
    expect(saved.morale).toBeLessThanOrEqual(85)
    expect(saved.money).toBe(900)
    expect(saved.hasActedThisCycle).toBe(true)
    expect(saved.outingsThisSeason).toBe(1)
    // 126 효과 팝업이 지도 위에 뜬다 (StrMODE[25] 소지금 · [24] 사기 + 외식회원증 보정 · [195] 효과 줄)
    expect(result.current.outingResult?.effectText).toMatch(/^!C소지금 100!cFF0000하락!cFFFFFF하였습니다!N사기 \d+\(\+4\)!c00CC00상승!cFFFFFF하였습니다!N!N!cFFFF00외식회원증 효과$/)
    expect(result.current.scene).toBe('외출')

    // [확인] → 105 (입원이 아니라 회복 글 없음)
    act(() => result.current.actions.closeOutingResult())
    expect(result.current.outingResult).toBeNull()
    expect(result.current.scene).toBe('관리')
    expect(result.current.outingRecoveryNotice).toBe('')
  })

  it('입원: 효과 팝업을 닫으면 105 로 가고 회복 글이 관리 화면 위에 남는다 (0x1575c)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() =>
      result.current.actions.save({ ...result.current.career!, morale: 50, money: 1000, isInjured: true, injuryRemaining: 1 }),
    )
    act(() => result.current.actions.openOuting())
    act(() => result.current.actions.runOutingFunction('입원'))
    act(() => result.current.actions.closeOutingResult())

    expect(result.current.scene).toBe('관리')
    // 남은 기간 1 → 먼저 −1 해 0 이면 반드시 낫는다
    expect(result.current.outingRecoveryNotice).toBe('!C부상에서 회복 되었습니다.')
    act(() => result.current.actions.dismissOutingRecoveryNotice())
    expect(result.current.outingRecoveryNotice).toBe('')
  })

  it('막히면 원문 알림만 띄우고 커리어는 그대로다 (StrMODE[62])', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, popularity: 0 }))
    const before = result.current.career

    act(() => result.current.actions.openOuting())
    act(() => result.current.actions.runOutingFunction('팬미팅'))

    expect(result.current.outingNotice).toBe('인기도가 부족합니다. 필요한 인기도 : 600')
    expect(result.current.career).toBe(before)
  })
})

describe('완투 계열 카운터 +0x1f0 — 옛 저장 호환', () => {
  it('칸이 없던 저장도 0 에서 시작한다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.create('투수', 신인))
    const { completeGameCounts: _빠짐, ...옛저장 } = store.load() as Record<string, unknown>
    store.save(옛저장)

    const 둘째판 = 띄우기(store)
    expect(둘째판.result.current.career?.completeGameCounts).toEqual({ perfect: 0, noHitter: 0, shutout: 0, completeGame: 0 })
  })
})

describe('기록연감 통계 고리 — 투수편 모드 3 (0x22e35 · 0x22c29 · 0xb663c)', () => {
  const 통계띄우기 = (career: ReturnType<typeof createPitcherCareer>) => {
    const store = 메모리저장()
    store.save(career)
    const events: AnnalsStatEvent[] = []
    const rendered = renderHook(() =>
      usePitcherLeagueSession(store, createSeededRandom(20100901), false, null, null, true, (event) => {
        events.push(event)
      }))
    return { rendered, events }
  }

  it('관리 화면이 G 를 줄여 저장하면(슬롯 확장·마구·구질 훈련) 투수편 소모 GP(k 2)에 줄어든 만큼', () => {
    const { rendered, events } = 통계띄우기({ ...createPitcherCareer('투수'), gamePoint: 6000 })
    const career = rendered.result.current.career!
    act(() => rendered.result.current.actions.save({ ...career, gamePoint: 1000, skillSlotLevel: 1 }))
    act(() => rendered.result.current.actions.save({ ...rendered.result.current.career!, morale: 10 }))
    expect(events).toEqual([{ kind: 'G사용', usage: 2, amount: 5000 }])
  })

  it('스킬을 새로 켜면 0xb663c(모드 3) 를 한 번 적는다', () => {
    const { rendered, events } = 통계띄우기({ ...createPitcherCareer('투수'), skillIds: [40], equippedSkillIds: [] })
    const career = rendered.result.current.career!
    act(() => rendered.result.current.actions.save({ ...career, equippedSkillIds: [40] }))
    act(() => rendered.result.current.actions.save({ ...rendered.result.current.career!, equippedSkillIds: [40] }))
    expect(events).toEqual([{ kind: '스킬장착', mode: 3, skillId: 40 }])
  })

  it('GP 아이템 구매가 확정되면 0x22e35(3, 칸) + 0x22c29(2, 가격)', () => {
    const { rendered, events } = 통계띄우기({ ...createPitcherCareer('투수'), gamePoint: 5000 })
    act(() => rendered.result.current.actions.purchase(shopItemId('GP', 3)))
    expect(events).toEqual([{ kind: 'GP아이템구매', mode: 3, index: 3, price: BATTER_GP_ITEMS[3].price }])
  })
})

describe('투수편 칭호도 관리 화면에서 하나씩 — 0x1a1c0 · 0x1274c · 0x1b1e4 (장면 0x106 공용)', () => {
  it('처음 맞는 하나를 띄우고 확인하면 주고 장착한 뒤 다음 것을 띄운다', async () => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    await waitFor(() => expect(result.current.storyEvents).not.toBeNull(), { timeout: 5000 })
    첫이벤트넘기기(result)
    for (let guard = 0; guard < 10 && result.current.scene === '이벤트'; guard += 1) 이벤트끝내기(result)
    expect(result.current.scene).toBe('관리')
    // 1년차 첫 경기 전 — 0 "이름 없는 신인" 이 먼저다
    expect(result.current.pendingTitle).toBe(TITLE_NAMES[0])
    act(() => result.current.actions.save({ ...result.current.career!, popularity: 4500 }))
    for (let guard = 0; guard < 10 && result.current.scene === '이벤트'; guard += 1) 이벤트끝내기(result)
    expect(result.current.pendingTitle).toBe(TITLE_NAMES[0])
    act(() => result.current.actions.confirmTitle())
    expect(result.current.career?.titleIds).toEqual([TITLE_NAMES[0]])
    expect(result.current.career?.equippedTitle).toBe(0)
    expect(result.current.pendingTitle).toBe(TITLE_NAMES[6])
    act(() => result.current.actions.confirmTitle())
    expect(result.current.pendingTitle).toBe(TITLE_NAMES[7])
    act(() => result.current.actions.confirmTitle())
    expect(result.current.career?.equippedTitle).toBe(7)
    expect(result.current.pendingTitle).toBeNull()
  })
})

describe('전역기록 +0x4f(모드 3 경기 중간 저장) — 142 확인 · 등록 · 정산 · 곧장 경기 (0x13cca · 0x112c0 · 0x4f3d6 · 0x327b8)', () => {
  const 경기요약 = {
    result: '승',
    seasonDelta: { outs: 21, runsAllowed: 1, strikeouts: 5, pitches: 90, wins: 1, losses: 0, saves: 0 },
    stamina: 3000,
    pitchCount: 90,
    hasEntered: true,
    recordIds: [],
    record: { outsRecorded: 21 },
    evaluation: { popularityChange: 0, reputationChange: 0, moraleChange: 0, countedCompleteGame: '없음' },
  } as unknown as Parameters<ReturnType<typeof 띄우기>['result']['current']['actions']['finishGame']>[0]

  const 손잡이띄우기 = () => {
    const calls: (NariGameMatch | '지움')[] = []
    const port: NariGameSavePort = { start: (match) => calls.push(match), clear: () => calls.push('지움') }
    const store = 메모리저장()
    const rendered = renderHook(() => usePitcherLeagueSession(
      store, createSeededRandom(20100901), false, null, null, true, undefined, undefined, undefined, undefined, port,
    ))
    return { calls, rendered, store, port }
  }

  it('등록 0x112c0 이 0, 142 확인이 굴린 마선수와 함께 1, 경기 끝 정산이 0', () => {
    const { calls, rendered } = 손잡이띄우기()
    const { result } = rendered
    act(() => result.current.actions.create('투수', 신인))
    expect(calls).toEqual(['지움'])
    act(() => result.current.actions.save({ ...result.current.career!, gamesPlayed: 4 }))
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    const aces = result.current.matchAces
    act(() => result.current.actions.confirmMatchPrepare())
    // 마선수는 커리어 저장의 나리 팀 레코드에 들었다 — 모드 저장 칸에는 국가대항전 여부만
    expect(aces).not.toBeNull()
    expect(calls).toEqual(['지움', { aces: null, isNationalCup: false }])
    const 레코드 = result.current.career!.nariTeams!
    expect(레코드[result.current.career!.teamId].acePitcher).toBe(aces!.myPitcher)
    expect(레코드[result.current.gameOptions!.opponentTeamId].batters[9]).toEqual({ slot: 12, position: 0, ace: aces!.opponentBatter })
    act(() => result.current.actions.finishGame(경기요약))
    expect(calls).toEqual(['지움', { aces: null, isNationalCup: false }, '지움'])
  })

  it('경기는 레코드로 선다 — 투수편 타자 배열은 붙박이 + 9번 마타자라 진행기가 세우는 명단과 같다', () => {
    const { rendered } = 손잡이띄우기()
    const { result } = rendered
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, gamesPlayed: 4 }))
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    act(() => result.current.actions.confirmMatchPrepare())
    const career = result.current.career!
    const options = result.current.gameOptions!
    const progress = startPitcherGame(options, createSeededRandom(5))
    expect(progress.ourLineup.rosterSlots).toEqual(nariLineupSlotsOf(career.nariTeams![career.teamId]))
    expect(progress.opponentLineup.rosterSlots).toEqual(nariLineupSlotsOf(career.nariTeams![options.opponentTeamId]))
  })

  it("143 경기 전 엔트리 보기 — '4' 내 팀(내 투수 · 마투수 칸) · 보기 전용 · 오른 끝에서 142 로", () => {
    const { rendered } = 손잡이띄우기()
    const { result } = rendered
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, gamesPlayed: 4 }))
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    const aces = result.current.matchAces!
    act(() => result.current.actions.openEntryView(true))
    const view = result.current.entryView!
    expect(view.lists.pitchers.map((row) => row.name)).toContain('투수')
    expect(view.lists.pitchers.filter((row) => row.isAce)).toHaveLength(1)
    expect(view.lists.batters[9].isAce).toBe(true)
    expect(view.lists.batters[9].name).toBe(ACE_BATTERS[aces.myBatter].name)
    act(() => result.current.actions.pressEntryViewKey('확인'))
    expect(result.current.entryView?.editor.first).toBe(-1)
    act(() => result.current.actions.pressEntryViewKey('오른'))
    expect(result.current.entryView).toBeNull()
    expect(result.current.scene).toBe('경기준비')
  })

  it('곧장 경기 — 142 를 거치지 않고(굴림 없음) 남겨 둔 마선수로 경기를 처음부터 세운다', () => {
    const { calls, rendered } = 손잡이띄우기()
    const { result } = rendered
    act(() => result.current.actions.create('투수', 신인))
    // 레코드가 없던 옛 저장 — 남은 match.aces 를 레코드에 넣는다
    const { nariTeams: _없음, ...옛저장 } = result.current.career!
    act(() => result.current.actions.save({ ...옛저장, gamesPlayed: 4, seasonEndState: 109 }))
    const aces = { myBatter: 0, myPitcher: 0, opponentPitcher: 4, opponentBatter: 1 }
    act(() => result.current.actions.resumeInterruptedGame({ aces, isNationalCup: false }))
    expect(result.current.scene).toBe('경기')
    expect(result.current.matchAces).toEqual(aces)
    expect(result.current.gameOptions?.aces).toMatchObject({
      ours: { batter: 0, pitcher: 0 },
      opponent: { batter: 1, pitcher: 4 },
    })
    expect(calls).toEqual(['지움'])
  })

  it('경기 중 나가기(0x22 → 0x40140)는 +0x4f 를 안 건드리고, 세션은 새로 선 장면의 이어하기 자리(109)로 돌아가 둔다', () => {
    const { calls, rendered, store } = 손잡이띄우기()
    const { result } = rendered
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, gamesPlayed: 4 }))
    act(() => result.current.actions.openNextGameStandings())
    act(() => result.current.actions.confirmNextGameStandings())
    act(() => result.current.actions.confirmMatchPrepare())
    expect(result.current.scene).toBe('경기')
    const saved = store.load()
    act(() => result.current.actions.quitGame())
    // 지움(clear)이 없다 — +0x4f 는 142 가 세운 그대로
    expect(calls.filter((call) => call === '지움')).toHaveLength(1)
    expect(result.current.gameOptions).toBeNull()
    // S+0x50 = 4(109) — 이어하기 0x1c154 는 109 로 간다
    expect(result.current.scene).toBe('다음경기순위')
    expect(result.current.nextGameFromManagement).toBe(false)
    // 저장 쓰기도 없다
    expect(store.load()).toEqual(saved)
  })
})
