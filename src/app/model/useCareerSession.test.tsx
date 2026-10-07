// @vitest-environment jsdom
import { useState } from 'react'
import { nariLineupSlotsOf } from '@/entities/career/model/nariTeamRecord'
import { describe, expect, it } from 'vitest'
import { NARI_YEAR_START_EVENT_ID } from '@/entities/story/model/storyScene'
import { act, renderHook, waitFor } from '@testing-library/react'
import { applyGameEvaluation, isEvaluatedGame, useCareerSession } from '@/app/model/useCareerSession'
import { advancePostseason, EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, startPostseason } from '@/entities/league/model/league'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SALARY_ACCEPT_EVENT_ID } from '@/entities/career/model/seasonFlow'
import { careerNationalCupRewardOf } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { createNariCupTeams } from '@/entities/career/model/nariCupTeams'
import { liveGameInningIndex, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { gamePointRewardOf } from '@/entities/career/model/playerCareer'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { startGame, summaryOf } from '@/features/play-game/model/gameFlow'
import { insertMyBatter, nariQuickLineupOf, seatAceBatter, tableNariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import type { NariGameMatch, NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'

/**
 * 나만의리그 연말 국가대표 사슬 — 연봉 사슬이 끝나면 상태 133(선발 판정)이 끼고,
 * 선발(461) → 출전(463) 이면 국가대항전 화면(134)으로, 탈락(462)·거절(464)이면 새 시즌이다.
 * (`docs/re/B-season-awards.md` 3절 · `docs/re/_raw/notes/P5-national-match.md` 1a·5절)
 */

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

/** 올해 목표를 다섯 개 다 이룬 연말 선수 — 45경기를 치르고 성적표까지 본 상태 */
const 목표달성선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => {
  const rookie = createCareer('국대')
  return {
    ...rookie,
    gamesPlayed: 45,
    stats: { ...rookie.stats, atBats: 1000, hits: 1000, homeRuns: 999, runsBattedIn: 999 },
    popularity: 9999,
    popularityAtSeasonStart: 0,
    ...overrides,
  }
}

/** 올해 목표를 하나도 못 이룬 선수 */
const 목표실패선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer =>
  목표달성선수({ stats: createCareer('국대').stats, popularity: 0, ...overrides })

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

/** 이벤트 하나를 막 다 본 자리 — `completeScene` 은 이벤트 화면 위에서만 듣는다 */
const 이벤트보기 = (rendered: ReturnType<typeof 띄우기>, eventIds: readonly number[]) => {
  act(() => rendered.result.current.setScreen({ kind: '이벤트', eventId: eventIds[0], context: '시즌' }))
  act(() => rendered.result.current.session.actions.completeScene([], eventIds))
}

/** 연말 사슬의 마지막 이벤트(383 연봉 수락)를 본다 — 그 다음이 국가대표 선발 판정 자리다 */
const 연봉사슬끝내기 = (rendered: ReturnType<typeof 띄우기>) =>
  이벤트보기(rendered, [SALARY_ACCEPT_EVENT_ID])

describe('연말 국가대표 선발 판정 (상태 133 = 0x1a090)', () => {
  it('홀수 년차 연말에 목표를 4개 이상 이루면 선발 이벤트 461 이 뜬다', () => {
    const rendered = 띄우기(목표달성선수())
    연봉사슬끝내기(rendered)

    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 461, context: '시즌' })
    // 대회가 끝나야 연차가 오른다 (0x1b768 은 0x1b92c 뒤다)
    expect(rendered.result.current.session.career?.season).toBe(1)
  })

  it('목표가 모자라면 탈락 이벤트 462 로 지나가고, 462 를 보면 새 시즌이다', () => {
    const rendered = 띄우기(목표실패선수())
    연봉사슬끝내기(rendered)

    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 462, context: '시즌' })

    이벤트보기(rendered, [462])

    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    expect(rendered.result.current.session.career?.season).toBe(2)
  })

  it('짝수 년차(2·4…년차) 연말에는 선발 판정 없이 새 시즌이다 (0x10cec)', () => {
    const rendered = 띄우기(목표달성선수({ season: 2 }))
    연봉사슬끝내기(rendered)

    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    expect(rendered.result.current.session.career?.season).toBe(3)
  })

  it('출전(463)을 고르면 대회가 서고 순위 화면으로, 거절(464)이면 바로 새 시즌이다', () => {
    const 출전 = 띄우기(목표달성선수())
    연봉사슬끝내기(출전)
    이벤트보기(출전, [461, 463])

    expect(출전.result.current.screen).toEqual({ kind: '국가대항전', cup: createNationalCup() })
    // 순위 화면 134 의 첫 틀(0x1b92c)이 칭호 8 "국가 대표" 를 주고 곧바로 장착한다
    expect(출전.result.current.session.career?.titleIds).toContain(TITLE_NAMES[8])
    expect(출전.result.current.session.career?.equippedTitle).toBe(8)
    // 0xb7bf0 + 133 — 대회 레코드 두 칸: 대표팀에 내 선수(내 칸) · 첫날 상대 일본
    const 대회칸 = 출전.result.current.session.career?.nariCupTeams
    expect(대회칸?.opponentTeamId).toBe(11)
    expect(대회칸?.korea.batters.some((row) => row.slot === -1)).toBe(true)

    // 142 → 경기: 대표팀 칸 타자 배열로 서고 내 선수가 그 칸 차례에 선다(벤치로 간 선수 하나가 는다)
    act(() => 출전.result.current.session.actions.startCupGame({ myTeam: 10, opponent: 11 }, createNationalCup()))
    act(() => 출전.result.current.session.actions.confirmMatchPrepare())
    const 경기 = 출전.result.current.session.progress!
    expect(경기.ourLineup.rosterSlots).toEqual(nariLineupSlotsOf(대회칸!.korea))
    expect(경기.ourLineup.benchBatters).toBe(대회칸!.korea.batters.length - 9)

    const 거절 = 띄우기(목표달성선수())
    연봉사슬끝내기(거절)
    이벤트보기(거절, [461, 464])

    expect(거절.result.current.screen).toEqual({ kind: '관리' })
    expect(거절.result.current.session.career?.season).toBe(2)
    expect(거절.result.current.session.career?.titleIds).not.toContain(TITLE_NAMES[8])
  })
})

describe('국가대항전 저장 · 이어하기 (S+0x12c · L+0xa8~ — 463 끝 0x8cd44 · 정산 0x4f3c4 저장, 0x1c154 1c348~1c358)', () => {
  it('출전(463) 끝 — S+0x50 = 3(웹 null) · 대회 칸이 저장에 든다', () => {
    const rendered = 띄우기(목표달성선수())
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])
    expect(rendered.result.current.session.career?.nationalCup).toEqual(createNationalCup())
    expect(rendered.result.current.session.career?.seasonEndState).toBeNull()
  })

  it('대회 중 저장을 이어하면 저장의 대회로 134 대진판에 돌아온다', () => {
    const cup = { ...createNationalCup(), stage: 3, day: 1, wins: [1, 0, 1, 0], losses: [0, 1, 0, 1] }
    const rendered = 띄우기(목표달성선수({ seasonEndState: null, nationalCup: cup }))
    expect(rendered.result.current.screen).toEqual({ kind: '국가대항전', cup })
  })

  it('S+0x50 특수값(132 연말 등)이 S+0x12c 보다 먼저다 — 463 전에 끊긴 저장은 132 로', () => {
    const rendered = 띄우기(목표달성선수({ seasonEndState: 132, nationalCup: createNationalCup() }))
    expect(rendered.result.current.screen.kind).toBe('이벤트')
  })
})

describe('전역 경기 상태 +0x6b — 타자편 경기도 같은 칸 (0x1c47a · 0x3a200 · 0xb6b6c)', () => {
  it('142 진입이 0 으로 되돌리고, 경기 중 나가면 그 이닝이 남는다', () => {
    const rendered = 띄우기({ ...createCareer('상태'), gamesPlayed: 4 })
    setLiveGameInningIndex(6)
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    expect(liveGameInningIndex()).toBe(0)
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    setLiveGameInningIndex(5)
    // 내 첫 타석까지 간이로 흘러간 그 이닝에서 나간다 — 0 부터 센 이닝 인덱스
    const 이닝 = rendered.result.current.session.progress!.game.inning
    act(() => rendered.result.current.session.actions.quitGame())
    expect(liveGameInningIndex()).toBe(이닝 - 1)
  })
})

describe('대회 끝 정산 (0x1b92c)', () => {
  it('우승 보상이 커리어에 들어가고 히든 팀이 열린 뒤 새 시즌으로 간다', () => {
    const 시작 = 목표달성선수({ popularity: 100, reputation: 0, money: 0, gamePoint: 0 })
    const rendered = 띄우기(시작)
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])

    act(() =>
      rendered.result.current.session.actions.finishCup({
        champion: 10,
        isKoreaChampion: true,
        koreaInFinal: true,
        reward: careerNationalCupRewardOf(10),
        openedTeams: [10, 11],
      }),
    )

    const 끝난뒤 = rendered.result.current.session.career
    // 새 시즌 0x1b768 의 1b774 — S+0x12c = 0 (대회 칸째 빠진다)
    expect(끝난뒤?.nationalCup).toBeUndefined()
    expect(끝난뒤?.popularity).toBe(120)
    expect(끝난뒤?.reputation).toBe(30)
    // 소지금 보상 한 칸 = 100만원, 웹 소지금은 만원 단위라 +2000 이다.
    // 5000 은 새 시즌 처리(0x1b768)가 같이 넣는 신인 연봉 50(=5000만)이다
    expect(끝난뒤?.money).toBe(2000 + 5000)
    expect(끝난뒤?.gamePoint).toBe(1000)
    expect(끝난뒤?.openedHiddenIds).toEqual([10, 11])
    expect(끝난뒤?.season).toBe(2)
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
  })

  it('⚠️ 나만의리그는 준우승·탈락에 보상이 없다 — 빈손으로 새 시즌이다 (원본 그대로)', () => {
    const rendered = 띄우기(목표달성선수({ popularity: 100, reputation: 0, money: 0, gamePoint: 0 }))
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])

    act(() =>
      rendered.result.current.session.actions.finishCup({
        champion: 11,
        isKoreaChampion: false,
        koreaInFinal: true,
        reward: careerNationalCupRewardOf(11),
        openedTeams: [10],
      }),
    )

    const 끝난뒤 = rendered.result.current.session.career
    expect(끝난뒤?.popularity).toBe(100)
    // 대회 보상은 0 — 남은 5000 은 새 시즌이 넣어 준 연봉뿐이다
    expect(끝난뒤?.money).toBe(5000)
    expect(끝난뒤?.gamePoint).toBe(0)
    // 대한민국은 출전만 해도 열린다 (0x65de5(g, 0))
    expect(끝난뒤?.openedHiddenIds).toEqual([10])
    expect(끝난뒤?.season).toBe(2)
  })
})

describe('대회 경기 한 바퀴 (135 → 142 → 사람 경기 → 101 → 134)', () => {
  it('135 확인은 142 경기 준비로 — [확인] 이면 대한민국으로 경기 화면에 들어가고 마선수는 안 싣는다(1c5fe)', () => {
    const rendered = 띄우기(목표달성선수())
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])
    const cup = createNationalCup()

    act(() => rendered.result.current.session.actions.startCupGame({ myTeam: 10, opponent: 11 }, cup))
    expect(rendered.result.current.screen).toEqual({ kind: '경기준비', cup: { matchup: { myTeam: 10, opponent: 11 }, cup } })

    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(rendered.result.current.session.progress?.ourTeamId).toBe(10)
    expect(rendered.result.current.session.progress?.opponentTeamId).toBe(11)
    expect(rendered.result.current.session.progress?.aces).toBeUndefined()
  })

  it('142 취소(−16)는 S+0x12c 갈래 — 135 순위표로 돌아간다 (0x13c72)', () => {
    const rendered = 띄우기(목표달성선수())
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])
    const cup = createNationalCup()

    act(() => rendered.result.current.session.actions.startCupGame({ myTeam: 10, opponent: 11 }, cup))
    act(() => rendered.result.current.session.actions.cancelMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '국가대항전', cup, atStandings: true })
  })
})

/**
 * **G 지갑 다리** — 원본 G는 전역 기록 `mgr[+0x64]` 한 칸이라 모드·선수와 상관없이 하나다
 * (`entities/wallet/model/gamePointWallet.ts` 머리글에 디스어셈).
 * 웹판은 커리어 칸(`gamePoint`)을 저장 호환용 그림자로 남겨 두고 지갑을 주인으로 삼는다.
 */
const 지갑띄우기 = (saved: PlayerCareer, 지갑저장: unknown) => {
  const saveGame = 메모리저장(saved)
  const random = createSeededRandom(20100901)
  let 적힌지갑 = 지갑저장
  const store: JsonStorePort = {
    load: () => 적힌지갑,
    save: (value) => {
      적힌지갑 = value
    },
  }
  return renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const wallet = useGamePointWallet(store, saved.gamePoint)
    return {
      screen,
      setScreen,
      wallet,
      session: useCareerSession({ runner, random, saveGame, screen, setScreen, wallet }),
    }
  })
}

describe('G 지갑 다리 (전역 mgr[+0x64])', () => {
  it('⚠️ 지갑 칸이 없던 옛 세이브는 `career.gamePoint` 가 지갑으로 이사한다', () => {
    const rendered = 지갑띄우기(목표달성선수({ gamePoint: 4500 }), null)
    expect(rendered.result.current.wallet.balance).toBe(4500)
  })

  it('선수를 불러와도 지갑이 이긴다 — 옛 세이브에 남은 값이 지갑을 되돌리지 않는다', () => {
    // 지갑은 이미 1200 (일반모드에서 마선수를 사고 남은 값), 옛 선수 칸은 4500 인 채다
    const rendered = 지갑띄우기(목표달성선수({ gamePoint: 4500 }), { gamePoint: 1200 })
    act(() => rendered.result.current.session.actions.continueSaved())

    expect(rendered.result.current.wallet.balance).toBe(1200)
    // 선수가 내보이는 값도 지갑 값이다 — 상점·상태 막대가 이 칸을 본다
    expect(rendered.result.current.session.career?.gamePoint).toBe(1200)
  })

  it('선수가 없는 동안 받은 보상도 지갑에 쌓이고, 선수를 불러오면 그 값이 보인다', () => {
    const rendered = 지갑띄우기(목표달성선수({ gamePoint: 0 }), { gamePoint: 0 })

    // 홈런더비·미션 보상 자리 (0x4f6cc · 0x4ef72) — 육성 선수가 안 올라온 채로 들어온다
    act(() => rendered.result.current.session.actions.gainGamePoint(3000))
    expect(rendered.result.current.wallet.balance).toBe(3000)

    act(() => rendered.result.current.session.actions.continueSaved())
    expect(rendered.result.current.session.career?.gamePoint).toBe(3000)
  })

  it('선수 쪽에서 G가 움직이면(대회 보상) 지갑으로 옮겨 간다', () => {
    const rendered = 지갑띄우기(목표달성선수({ popularity: 100, reputation: 0, money: 0, gamePoint: 0 }), {
      gamePoint: 500,
    })
    act(() => rendered.result.current.session.actions.continueSaved())
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])

    act(() =>
      rendered.result.current.session.actions.finishCup({
        champion: 10,
        isKoreaChampion: true,
        koreaInFinal: true,
        reward: careerNationalCupRewardOf(10),
        openedTeams: [10, 11],
      }),
    )

    // 지갑 500 + 우승 보상 1000
    expect(rendered.result.current.wallet.balance).toBe(1500)
    expect(rendered.result.current.session.career?.gamePoint).toBe(1500)
  })
})

describe('연속 파울 기록 32·33 (0xa7dbc) — 실제 타석에서 경기 기록까지', () => {
  const 공 = (resolution: PitchOutcomeDetail['resolution']): PitchOutcomeDetail => ({
    resolution,
    hasSwung: resolution.kind !== '볼',
    isBunt: false,
    resultCode: null,
    contactSoundId: null,
  })
  const 파울 = 공({ kind: '파울' })
  const 헛스윙 = 공({ kind: '스트라이크', isSwinging: true })

  const 경기띄우기 = () => {
    const saveGame = 메모리저장(createCareer('파울'))
    const random = createSeededRandom(20100901)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
    })
    act(() => rendered.result.current.session.actions.continueSaved())
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    // 109 순위표 확인 → 경기
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    act(() => rendered.result.current.session.actions.finishLoading())
    return rendered
  }
  /** 반 이닝 시뮬레이션이 남기는 수비 기록(16~)은 빼고 연속 파울 둘만 본다 */
  const 파울기록 = (recordIds: readonly number[] | undefined) =>
    (recordIds ?? []).filter((id) => id === 32 || id === 33)
  const 던지기 = (rendered: ReturnType<typeof 경기띄우기>, pitches: readonly PitchOutcomeDetail[]) => {
    for (const pitch of pitches) act(() => rendered.result.current.session.handlePitchResolved(pitch))
  }

  it('142 에서 굴린 마선수 넷이 경기 팀에 실린다 — 0xb88c8 · 0xb8870 (명부 투수 8번 · 명단 9번)', () => {
    const rendered = 경기띄우기()
    const aces = rendered.result.current.session.matchAces
    const progress = rendered.result.current.session.progress
    expect(aces).not.toBeNull()
    expect(progress?.aces?.ours).toEqual({ batter: aces?.myBatter, pitcher: aces?.myPitcher })
    expect(progress?.aces?.opponent).toEqual({ batter: aces?.opponentBatter, pitcher: aces?.opponentPitcher })
    expect(progress?.opponentPitcherOrder).toHaveLength(9)
    // 내 팀 명단은 저장의 나리 팀 레코드 차례 — 등록 0xb53f1 이 내 칸(타순 − 1)의 선수를 맨 끝 벤치로 보냈고(13명),
    // 142 의 0xb53f1 이 마타자를 9번 칸에 넣으며 옛 9번을 맨 끝으로(14명). 벤치 수 +0x28c = 14 − 9
    const 내칸 = rendered.result.current.session.career!.battingOrder - 1
    expect(progress?.ourLineup.rosterSlots).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 10, 11, 내칸, 9])
    expect(progress?.ourLineup.benchBatters).toBe(5)
    expect(progress?.opponentLineup.rosterSlots).toHaveLength(13)
  })

  it('한 타석 파울 넷이면 32·33 이 경기 기록에 들어가고 G 수입이 된다', () => {
    const rendered = 경기띄우기()
    try {
      expect(rendered.result.current.screen).toEqual({ kind: '경기' })
      던지기(rendered, [파울, 파울, 파울, 파울, 헛스윙])

      const progress = rendered.result.current.session.progress
      expect(파울기록(progress?.recordIds)).toEqual([32, 33])
      // 경기 요약 → G 수입(0x4ea0c)까지 32·33 몫이 들어간다
      const summary = summaryOf(progress!)
      const 나머지 = summary.recordIds.filter((id) => id !== 32 && id !== 33)
      expect(recordGamePointsOf([32, 33])).toBeGreaterThan(0)
      expect(gamePointRewardOf(summary)).toBe(recordGamePointsOf(나머지) + recordGamePointsOf([32, 33]))
    } finally {
      act(() => rendered.unmount())
    }
  })

  it('타석이 바뀌면 카운터가 새로 시작한다 — 두 타석에 걸친 파울은 이어지지 않는다', () => {
    const rendered = 경기띄우기()
    try {
      던지기(rendered, [파울, 파울, 헛스윙])
      act(() => rendered.result.current.runner.resetAtBat())
      던지기(rendered, [파울, 헛스윙, 헛스윙])
      expect(파울기록(rendered.result.current.session.progress?.recordIds)).toEqual([])
    } finally {
      act(() => rendered.unmount())
    }
  })
})

describe('공마다 상대 투수 투구 수·스태미나 (0x3dec6 → 0xa5e14(ctx, 구질))', () => {
  const 볼 = (pitchTypeNumber?: number): PitchOutcomeDetail => ({
    resolution: { kind: '볼' },
    hasSwung: false,
    isBunt: false,
    resultCode: null,
    contactSoundId: null,
    ...(pitchTypeNumber === undefined ? {} : { pitchTypeNumber }),
  })

  it('구질 번호가 실린 공마다 투구 수 +1 과 스태미나가 깎이고, 번호가 없으면 그대로다', () => {
    const saveGame = 메모리저장(createCareer('투구수'))
    const random = createSeededRandom(20100901)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
    })
    try {
      act(() => rendered.result.current.session.actions.continueSaved())
      act(() => rendered.result.current.session.actions.runCommand('다음경기'))
      // 109 순위표 확인 → 경기
      act(() => rendered.result.current.session.actions.confirmNextGameStandings())
      act(() => rendered.result.current.session.actions.confirmMatchPrepare())
      act(() => rendered.result.current.session.actions.finishLoading())
      const before = rendered.result.current.session.progress!.opponentMound
      act(() => rendered.result.current.session.handlePitchResolved(볼(1)))
      act(() => rendered.result.current.session.handlePitchResolved(볼(18)))
      const after = rendered.result.current.session.progress!.opponentMound
      expect(after.pitches).toBe(before.pitches + 2)
      expect(after.stamina).toBeLessThan(before.stamina)
      act(() => rendered.result.current.session.handlePitchResolved(볼()))
      expect(rendered.result.current.session.progress!.opponentMound).toEqual(after)
    } finally {
      act(() => rendered.unmount())
    }
  })
})

describe('훈련·휴식 결과 창 — 변화량은 굴린 값 그대로, 필살타법은 창이 없다 (0x17f5c · 0x18bd8 · 0x18dd8)', () => {
  const 관리띄우기 = (career: PlayerCareer) => {
    const saveGame = 메모리저장(career)
    const random = createSeededRandom(20100901)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
    })
    act(() => rendered.result.current.session.actions.continueSaved())
    return rendered
  }

  it('능력치 훈련: 상세 창 변화량 = 훈련 칸 상승 굴림 · 사기 칸 −감소 굴림 (0x18d0e~0x18d38)', () => {
    const rendered = 관리띄우기({ ...createCareer('훈련'), morale: 50 })
    try {
      act(() => rendered.result.current.session.actions.runTrainingMenu('히트'))
      const detail = rendered.result.current.session.managementDetail
      expect(detail).not.toBeNull()
      expect(detail?.changes).toBeDefined()
      expect(detail?.changes?.ability.power).toBe(0)
      expect(detail?.changes?.ability.hit).toBeGreaterThan(0)
      expect(detail?.changes?.morale).toBeLessThan(0)
      expect(detail?.afterClose).toEqual({ kind: '훈련', isSpecialSwing: false })
    } finally {
      act(() => rendered.unmount())
    }
  })

  it('휴식: 사기 칸 = 회복 굴림 그대로 (0x18fb4), 능력치 칸은 0', () => {
    const rendered = 관리띄우기({ ...createCareer('휴식'), morale: 95 })
    try {
      act(() => rendered.result.current.session.actions.runCommand('휴식'))
      const detail = rendered.result.current.session.managementDetail
      expect(detail?.after.morale).toBe(100)
      // 100 에서 잘리기 전 값 — 전후 차이(5)보다 크다
      expect(detail?.changes?.morale).toBeGreaterThanOrEqual(10)
      expect(detail?.changes?.ability).toEqual({ hit: 0, power: 0, defense: 0, run: 0 })
    } finally {
      act(() => rendered.unmount())
    }
  })

  it('필살타법: 상세 창 대신 알림 창 하나 — [확인] 이면 관리 화면 그대로, 부상을 안 굴린다', () => {
    // 사기 0 근처면 부상 확률이 가장 높다 — 굴렸다면 걸릴 수 있는 자리다
    const rendered = 관리띄우기({ ...createCareer('필살'), morale: 5, gamePoint: 600 })
    try {
      act(() => rendered.result.current.session.actions.runTrainingMenu('필살타법'))
      const { session } = rendered.result.current
      expect(session.managementDetail).toBeNull()
      expect(session.managementNotice).toContain('!N')
      expect(session.managementNotice).toContain('사기')
      const trained = session.career
      act(() => rendered.result.current.session.actions.dismissManagementNotice())
      expect(rendered.result.current.session.managementNotice).toBe('')
      expect(rendered.result.current.session.career?.isInjured).toBe(trained?.isInjured)
    } finally {
      act(() => rendered.unmount())
    }
  })
})

describe('CPU 견제 (0x345fc 종류 4 → 0x34848) — 타자편도 견제 판을 재생하고 같은 타석을 잇는다', () => {
  const 볼: PitchOutcomeDetail = {
    resolution: { kind: '볼' },
    hasSwung: false,
    isBunt: false,
    resultCode: null,
    contactSoundId: null,
  }

  it('주자 있는 루면 견제 판이 재생 칸에 들고 볼카운트·투구 수는 그대로다 — 빈 루면 아무 일도 없다', () => {
    const saveGame = 메모리저장(createCareer('견제'))
    // 씨앗 1 — 볼넷으로 주자가 서는 판. 장면 덱 섞기(경기 시작 0x3e340)가 끼며 20100901 은 볼넷 타석 앞에 이닝이 바뀌는 판이 됐다
    const random = createSeededRandom(1)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
    })
    try {
      act(() => rendered.result.current.session.actions.continueSaved())
      act(() => rendered.result.current.session.actions.runCommand('다음경기'))
      // 109 순위표 확인 → 경기
      act(() => rendered.result.current.session.actions.confirmNextGameStandings())
      act(() => rendered.result.current.session.actions.confirmMatchPrepare())
      act(() => rendered.result.current.session.actions.finishLoading())
      // 볼넷으로 나가며 주자가 있는 내 타석이 올 때까지 돌린다
      for (let atBat = 0; atBat < 9; atBat += 1) {
        const { bases } = rendered.result.current.session.progress!.game
        if (bases.first || bases.second || bases.third) break
        for (let pitch = 0; pitch < 4; pitch += 1) act(() => rendered.result.current.session.handlePitchResolved(볼))
        act(() => rendered.result.current.runner.resetAtBat())
      }
      const before = rendered.result.current.session.progress!
      const { bases } = before.game
      const occupied = bases.first ? 1 : bases.second ? 2 : bases.third ? 3 : null
      const empty = !bases.first ? 1 : !bases.second ? 2 : !bases.third ? 3 : null
      expect(occupied).not.toBeNull()
      if (empty !== null) {
        act(() => rendered.result.current.session.actions.cpuPickoff(empty))
        expect(rendered.result.current.session.progress).toBe(before)
      }
      act(() => rendered.result.current.session.handlePitchResolved(볼))
      const counted = rendered.result.current.session.progress!
      act(() => rendered.result.current.session.actions.cpuPickoff(occupied!))
      const after = rendered.result.current.session.progress!
      expect(after.lastDefensePlay).not.toBeNull()
      expect(after.lastDefensePlay).not.toBe(counted.lastDefensePlay)
      expect(after.opponentMound.pitches).toBe(counted.opponentMound.pitches)
      if (after.game.half === counted.game.half && !after.game.isFinished) {
        expect(rendered.result.current.runner.atBat.balls).toBe(1)
      }
    } finally {
      act(() => rendered.unmount())
    }
  })
})

describe('외출 장소 기능 가드 (113 키 0x16cf0) — 막히면 원문 알림만', () => {
  it.each([
    ['소지금 부족(StrMODE[77])', { money: 0 }, '외식', '소지금이 부족합니다'],
    ['인기도 부족(StrMODE[62])', { popularity: 0 }, '팬미팅', '인기도가 부족합니다. 필요한 인기도 : 600'],
    ['건강한데 입원(StrMODE[196])', { isInjured: false, isSick: false, money: 9999 }, '입원', '건강한 상태입니다 입원할 필요가 없습니다'],
  ] as const)('%s — 예외 없이 알림을 띄우고 커리어는 그대로다', (_label, overrides, functionId, notice) => {
    const rendered = 띄우기({ ...createCareer('외출'), morale: 50, ...overrides })
    const before = rendered.result.current.session.career

    act(() => rendered.result.current.session.actions.runOutingFunction(functionId))

    expect(rendered.result.current.session.outingNotice).toBe(notice)
    expect(rendered.result.current.session.career).toBe(before)
  })
})

describe('마선수 대결로 나가는 장소 이벤트 — match 의 "끝남" 으로 0x1c014 장소 끝 처리가 나가는 자리에서 돈다 (0x8d904)', () => {
  it('나갈 때 행동을 쓰고 외출 수 +1, 140 결과 이벤트(대결결과) 끝에서는 다시 안 쓰고 105', () => {
    const rendered = 띄우기({ ...createCareer('대결'), morale: 50 })
    act(() => rendered.result.current.setScreen({ kind: '이벤트', eventId: 113, context: '장소' }))
    const before = rendered.result.current.session.career!

    act(() => rendered.result.current.session.actions.settlePlaceForAceMatch())
    expect(rendered.result.current.session.career?.hasActedThisCycle).toBe(true)
    expect(rendered.result.current.session.career?.outingsThisSeason).toBe(before.outingsThisSeason + 1)

    act(() => rendered.result.current.setScreen({ kind: '이벤트', eventId: 114, context: '대결결과' }))
    act(() => rendered.result.current.session.actions.completeScene([], [113, 114]))
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    expect(rendered.result.current.session.career?.outingsThisSeason).toBe(before.outingsThisSeason + 1)
    expect(rendered.result.current.session.career?.seenEventIds).toEqual(expect.arrayContaining(['113', '114']))
  })
})

describe('외출 126 — 효과 팝업 → 105 (0x15234 · 0x1575c)', () => {
  it('장소 기능을 고르면 효과 팝업이 뜨고, [확인] 이면 관리 화면으로 가며 입원 회복 글은 관리 알림이 된다', () => {
    const rendered = 띄우기({ ...createCareer('외출'), morale: 50, money: 1000, isInjured: true, injuryRemaining: 1 })
    act(() => rendered.result.current.setScreen({ kind: '외출' }))

    act(() => rendered.result.current.session.actions.runOutingFunction('입원'))
    expect(rendered.result.current.session.outingResult?.effectText).toMatch(/^!C소지금 200!cFF0000하락/)
    expect(rendered.result.current.session.career?.hasActedThisCycle).toBe(true)
    expect(rendered.result.current.screen).toEqual({ kind: '외출' })

    act(() => rendered.result.current.session.actions.closeOutingResult())
    expect(rendered.result.current.session.outingResult).toBeNull()
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    expect(rendered.result.current.session.managementNotice).toBe('!C부상에서 회복 되었습니다.')
  })
})

describe('기록연감 통계 고리 [mgr+0xc8] — 타자편 모드 4 (0x22e35 · 0x22c29 · 0x22c7d · 0xb663c)', () => {
  const 통계띄우기 = (career: PlayerCareer) => {
    const saveGame = 메모리저장(career)
    const random = createSeededRandom(20100901)
    const events: AnnalsStatEvent[] = []
    const recordStat = (event: AnnalsStatEvent) => {
      events.push(event)
    }
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, setScreen, session: useCareerSession({ runner, random, saveGame, screen, setScreen, recordStat }) }
    })
    act(() => rendered.result.current.session.actions.continueSaved())
    return { rendered, events }
  }

  it('필살타법 훈련은 0xa3cac — 타자편 소모 GP(k 1)에 그 레벨 비용을 적는다', () => {
    const { rendered, events } = 통계띄우기({ ...createCareer('필살'), morale: 50, gamePoint: 600 })
    act(() => rendered.result.current.session.actions.runTrainingMenu('필살타법'))
    expect(events).toEqual([{ kind: 'G사용', usage: 1, amount: 500 }])
    act(() => rendered.unmount())
  })

  it('슬롯 확장은 0x148d8 — 성공할 때만 비용을 적는다', () => {
    const { rendered, events } = 통계띄우기({ ...createCareer('확장'), gamePoint: 5000 })
    act(() => rendered.result.current.session.actions.expandSkillSlots())
    expect(events).toEqual([{ kind: 'G사용', usage: 1, amount: 5000 }])
    act(() => rendered.result.current.session.actions.expandSkillSlots())
    expect(events).toHaveLength(1)
    act(() => rendered.unmount())
  })

  it('스킬을 새로 켤 때만 0xb663c 비트를 적는다 — 이미 켜진 스킬·끄기는 안 적는다', () => {
    const { rendered, events } = 통계띄우기({ ...createCareer('스킬'), skillIds: [20], equippedSkillIds: [] })
    act(() => rendered.result.current.session.actions.equipSkill(20, true))
    act(() => rendered.result.current.session.actions.equipSkill(20, true))
    act(() => rendered.result.current.session.actions.equipSkill(20, false))
    expect(events).toEqual([{ kind: '스킬장착', mode: 4, skillId: 20 }])
    act(() => rendered.unmount())
  })

  it('GP 아이템 구매가 확정되면 0x22e35(4, 칸) + 0x22c29(1, 가격), G 가 모자라면 안 적는다', () => {
    const { rendered, events } = 통계띄우기({ ...createCareer('상점'), gamePoint: 0 })
    act(() => rendered.result.current.session.actions.purchase('GP:3:0'))
    expect(events).toEqual([])
    act(() => rendered.unmount())

    const 넉넉 = 통계띄우기({ ...createCareer('상점'), gamePoint: 5000 })
    act(() => 넉넉.rendered.result.current.session.actions.purchase('GP:3:0'))
    expect(넉넉.events).toEqual([{ kind: 'GP아이템구매', mode: 4, index: 3, price: BATTER_GP_ITEMS[3].price }])
    act(() => 넉넉.rendered.unmount())
  })

  it('국가대항전 우승 보상은 0x1bb14 — 획득 GP(모드 4)에 1000', () => {
    const { rendered, events } = 통계띄우기(목표달성선수({ popularity: 100, gamePoint: 0 }))
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])
    act(() =>
      rendered.result.current.session.actions.finishCup({
        champion: 10, isKoreaChampion: true, koreaInFinal: true, reward: careerNationalCupRewardOf(10), openedTeams: [],
      }),
    )
    expect(events.filter((event) => event.kind === 'G획득')).toEqual([{ kind: 'G획득', mode: 4, amount: 1000 }])
    act(() => rendered.unmount())
  })
})

describe('타자편 경기 뒤 평가 게이트 (0x4f216 · 0x4f268 → 0xa719c)', () => {
  const 평가 = { popularityChange: 5, reputationChange: 3, moraleChange: -4 }

  it('정규시즌 경기는 인기도 → 평판 → 사기를 얹는다', () => {
    const career = { ...createCareer('평가'), popularity: 100, reputation: 100, morale: 50 }
    expect(isEvaluatedGame(career)).toBe(true)
    expect(applyGameEvaluation(career, 평가, true)).toMatchObject({ popularity: 105, reputation: 103, morale: 46 })
  })

  it('포스트시즌 경기(경기 전 커리어에 대진이 서 있으면)는 평가하지 않는다', () => {
    const career = { ...createCareer('평가'), postseason: startPostseason([0, 1, 2, 3, 4, 5, 6, 7]) }
    expect(isEvaluatedGame(career)).toBe(false)
    expect(applyGameEvaluation(career, 평가, false)).toBe(career)
  })
})

describe('타자편 포스트시즌 대진 128 — 사람이 친다 (0x120a4 · 0x13da0 · 0x15984)', () => {
  /** 팀 번호가 작을수록 많이 이긴 정규시즌 — 순위가 0, 1, 2, … */
  const 순서대로리그 = {
    ...EMPTY_LEAGUE,
    wins: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 40 - team),
    losses: Array.from({ length: LEAGUE_TEAM_COUNT }, (_, team) => 5 + team),
  }
  const 시즌끝선수 = (overrides: Partial<PlayerCareer> = {}): PlayerCareer => ({
    ...createCareer('포스트'),
    teamId: 0,
    gamesPlayed: 45,
    league: 순서대로리그,
    postseason: startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    popularity: 1000,
    reputation: 300,
    money: 1000,
    ...overrides,
  })

  it('목표 결과 뒤 130 타이틀(370) → 131 MVP(375) — 375 를 틀 때 MVP 비트를 남긴다 (0x19774 → 0x8dd60)', () => {
    const 삼관왕 = 시즌끝선수({
      season: 2,
      stats: { ...createCareer('포스트').stats, atBats: 300, hits: 150, homeRuns: 60, runsBattedIn: 150 },
    })
    const rendered = 띄우기(삼관왕)
    이벤트보기(rendered, [396])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 370, context: '시즌' })
    expect(rendered.result.current.session.career?.mvpSeasonBits).toBe(0)

    이벤트보기(rendered, [370])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 374, context: '시즌' })
    이벤트보기(rendered, [374])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 375, context: '시즌' })
    expect(rendered.result.current.session.career?.mvpSeasonBits).toBe(0b10)
    이벤트보기(rendered, [375])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 377, context: '시즌' })
  })

  it('MVP 결과(376/377) 뒤에 대진 128 로 가고, 정규시즌 1위면 [191] 보상 팝업 0xb 가 뜬다', () => {
    const rendered = 띄우기(시즌끝선수())
    이벤트보기(rendered, [376])
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '정규시즌우승' }, fromReentry: false })

    // 팝업이 떠 있으면 키가 안 먹는다
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.session.career?.postseason?.round).toBe('준플레이오프')

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
    expect(rendered.result.current.session.career).toMatchObject({
      popularity: 1010,
      money: 1500,
      regularSeasonRewardTaken: true,
    })
  })

  it('[확인] — CPU 끼리 내 차례(1위는 한국시리즈)까지 돌고 머물렀다가, 다음 [확인]에 내 경기를 연다', () => {
    const rendered = 띄우기(시즌끝선수({ regularSeasonRewardTaken: true }))
    이벤트보기(rendered, [376])
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })

    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
    const series = rendered.result.current.session.career?.postseason
    expect(series?.round).toBe('한국시리즈')
    expect(series?.teams[0]).toBe(0)

    act(() => rendered.result.current.session.actions.pressPostseason())
    // 내 차례 → 142 경기 준비 (128 의 배경음 표시를 들고 간다)
    expect(rendered.result.current.screen).toEqual({ kind: '경기준비', postseasonFromReentry: false })
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(rendered.result.current.session.progress?.opponentTeamId).toBe(series?.teams[1])
  })

  it('[다음경기] → 109 순위표 (이전 105) — 취소는 105 로, 확인은 경기 (0x105f0)', () => {
    const rendered = 띄우기(createCareer('순위'))
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: true })
    act(() => rendered.result.current.session.actions.cancelNextGameStandings())
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    expect(rendered.result.current.screen).toEqual({ kind: '경기준비' })
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
  })

  it('142 경기 준비 0x1c46c — 장면마다 한 번 마선수 넷을 굴리고, 취소는 109(이전 142 라 취소 안 먹음) · 다시 와도 안 굴린다', () => {
    const rendered = 띄우기({ ...createCareer('준비'), gamesPlayed: 4 })
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    expect(rendered.result.current.screen).toEqual({ kind: '경기준비' })
    const 굴림 = rendered.result.current.session.matchAces
    // 기본 개방은 마투수 0 · 마타자 0 뿐 — 내 쪽은 늘 0, 상대는 0 과 겹치지 않는다
    expect(굴림).toMatchObject({ myBatter: 0, myPitcher: 0 })
    expect(굴림?.opponentPitcher).not.toBe(0)
    act(() => rendered.result.current.session.actions.cancelMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    expect(rendered.result.current.session.career?.seasonEndState).toBe(109)
    act(() => rendered.result.current.session.actions.cancelNextGameStandings())
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    expect(rendered.result.current.session.matchAces).toBe(굴림)
  })

  it('128 내 차례 → 142, 취소하면 128 진입을 다시 밟는다 (S+0xb4 갈래, 0x13ca0)', () => {
    const rendered = 띄우기(시즌끝선수({ regularSeasonRewardTaken: true }))
    이벤트보기(rendered, [376])
    act(() => rendered.result.current.session.actions.pressPostseason())
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '경기준비', postseasonFromReentry: false })
    act(() => rendered.result.current.session.actions.cancelMatchPrepare())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
    expect(rendered.result.current.session.career?.seasonEndState).toBe(128)
  })

  it('109 진입 0x10d8c 가 S+0x50 = 4 를 저장 — 이어하기는 109 로(이전 상태 1 · 취소 안 먹음), 105 로 물러나면 3 (0x11990)', () => {
    const rendered = 띄우기({ ...createCareer('이어'), gamesPlayed: 4 })
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    expect(rendered.result.current.session.career?.seasonEndState).toBe(109)
    const 다시 = 띄우기(rendered.result.current.session.career!)
    expect(다시.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    act(() => 다시.result.current.session.actions.cancelNextGameStandings())
    expect(다시.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    act(() => rendered.result.current.session.actions.cancelNextGameStandings())
    expect(rendered.result.current.session.career?.seasonEndState).toBeNull()
    expect(띄우기(rendered.result.current.session.career!).result.current.screen).toEqual({ kind: '관리' })
  })

  it('관리 주기가 아닌 경기 뒤는 100 → 109 — 이전 상태가 100 이라 취소가 안 먹는다 (0x1c346 · 0x1060e)', () => {
    const rendered = 띄우기({ ...createCareer('홀수'), gamesPlayed: 3 })
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    act(() => rendered.result.current.session.actions.cancelNextGameStandings())
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
  })

  it('정규시즌 홈/원정도 0xb7844 — 일정표 짝 중 번호가 큰 팀은 첫 9일 원정이라 선공이다', () => {
    // 0일째 1 대 0 — 1 이 원정(선공), 0 은 홈(후공)
    const 원정 = 띄우기({ ...createCareer('원정'), teamId: 1 })
    act(() => 원정.result.current.session.actions.runCommand('다음경기'))
    // 109 순위표 확인 → 경기
    act(() => 원정.result.current.session.actions.confirmNextGameStandings())
    act(() => 원정.result.current.session.actions.confirmMatchPrepare())
    expect(원정.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)

    const 홈 = 띄우기({ ...createCareer('홈'), teamId: 0 })
    act(() => 홈.result.current.session.actions.runCommand('다음경기'))
    // 109 순위표 확인 → 경기
    act(() => 홈.result.current.session.actions.confirmNextGameStandings())
    act(() => 홈.result.current.session.actions.confirmMatchPrepare())
    expect(홈.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
  })

  it('홈/원정은 0xb7844 포스트시즌 갈래 — 대진 윗 시드(칸 0)가 후공, 아랫 시드는 선공이다', () => {
    // 준PO 는 3위(2) 대 4위(3) — 4위는 아랫 시드라 선공
    const 진행중 = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [1, 0] as [number, number] }
    const 아랫시드 = 띄우기(시즌끝선수({ teamId: 3, gamesPlayed: 46, postseason: 진행중, regularSeasonRewardTaken: true }))
    act(() => 아랫시드.result.current.session.actions.confirmGameResult())
    act(() => 아랫시드.result.current.session.actions.pressPostseason())
    act(() => 아랫시드.result.current.session.actions.confirmMatchPrepare())
    expect(아랫시드.result.current.screen).toEqual({ kind: '경기' })
    expect(아랫시드.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)

    const 윗시드 = 띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 46, postseason: 진행중, regularSeasonRewardTaken: true }))
    act(() => 윗시드.result.current.session.actions.confirmGameResult())
    act(() => 윗시드.result.current.session.actions.pressPostseason())
    act(() => 윗시드.result.current.session.actions.confirmMatchPrepare())
    expect(윗시드.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
  })

  it('포스트시즌 날짜 카운터 g 는 시리즈 안 경기 수다 (L+0x32 — 0xb80a8 0 · 0xb7724 −1 · 0xb818c +1)', () => {
    // 준PO 3위(2) 대 4위(3), 1승 1패 뒤 셋째 경기 — g = 2. 커리어 경기 수(47)는 g 가 아니다
    const 대진 = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [1, 1] as [number, number] }
    const rendered = 띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 47, postseason: 대진, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    act(() => rendered.result.current.session.actions.pressPostseason())
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    expect(rendered.result.current.session.progress?.ourStartingPitcherIndex).toBe(2)
    expect(rendered.result.current.session.progress?.opponentStartingPitcherIndex).toBe(2)
  })

  it('포스트시즌 경기 결과 [확인] 은 관리 주기 대신 대진 128 로 돌아간다 — 시리즈가 이어질 때 (116 끝 g ≠ 0)', () => {
    const 진행중 = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), teams: [0, 2] as const, wins: [1, 1] as [number, number] }
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 47, postseason: 진행중, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
  })

  it('내 시리즈가 끝난 경기 뒤는 116 끝 g == 0 → 136 — 시즌 끝 사슬(392 → 370 → 375)을 다시 돌고 128 로 (0x12b74~0x12b94)', () => {
    // 준PO 3위(2) 대 4위(3) 2승 1패에서 내가(2) 이겨 시리즈를 끝냈다 — 다음 라운드(PO)가 막 열려 g = 0
    const 끝난준PO = advancePostseason({ ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [2, 1] }, 2)
    expect(끝난준PO.round).toBe('플레이오프')
    const rendered = 띄우기(
      시즌끝선수({ teamId: 2, gamesPlayed: 49, postseason: 끝난준PO, regularSeasonRewardTaken: true, seasonEndState: 128 }),
    )
    // 이어하기는 128 — 경기 결과 화면에서 [확인] 했다 치고 116 의 끝을 밟는다
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '시즌종료' })
    act(() => rendered.result.current.session.actions.beginYearEnd())
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 392, context: '시즌' })
    expect(rendered.result.current.session.career?.seasonEndState).toBe(136)
    이벤트보기(rendered, [396])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 370, context: '시즌' })
    이벤트보기(rendered, [371])
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 375, context: '시즌' })
    이벤트보기(rendered, [376])
    // 다시 128 — 정규시즌 우승 보상(S+0x77)은 이미 받아 팝업이 없다
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: false })
    expect(rendered.result.current.session.career?.postseason).toEqual(끝난준PO)
  })

  it('경기 뒤(116, S+0x50 = 2)에 끊긴 이어하기도 116 의 끝처럼 — g == 0 이면 시즌 끝, 아니면 128', () => {
    const 끝난준PO = advancePostseason({ ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [2, 1] }, 2)
    expect(띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 49, postseason: 끝난준PO })).result.current.screen).toEqual({
      kind: '시즌종료',
    })
    const 진행중 = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [1, 1] as [number, number] }
    expect(
      띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 47, postseason: 진행중, regularSeasonRewardTaken: true })).result.current
        .screen,
    ).toEqual({ kind: '포스트시즌', popup: null, fromReentry: true })
  })

  it('내 팀 우승 — 팝업 7 [137] → 팝업 8 [190] 보상 → 연말(132) 이벤트', () => {
    const 끝난대진 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, teams: [0, 1] as const, champion: 0 }
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 50, postseason: 끝난대진, regularSeasonRewardTaken: true }))
    // 한국시리즈를 끝낸 경기 뒤 116 은 g == 0 → 136 사슬을 다시 돌아 131 뒤 128 로 온다
    이벤트보기(rendered, [376])
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '우승발표', champion: 0 } , fromReentry: false })

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '한국시리즈우승' }, fromReentry: false })

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.session.career).toMatchObject({ popularity: 1015, reputation: 325, money: 2000 })
    // 1년차 연말은 연봉협상 380
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
  })

  it('이어하기 — 128 에서 저장했으면 대진으로 돌아오고, 정규시즌 우승 보상은 다시 안 준다 (S+0x50 0xf · S+0x77)', () => {
    const 받음 = 시즌끝선수({ seasonEndState: 128, regularSeasonRewardTaken: true, popularity: 1010, money: 1500 })
    const rendered = 띄우기(받음)
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: true })
    expect(rendered.result.current.session.career).toMatchObject({ popularity: 1010, money: 1500 })

    // 보상 팝업을 닫기 전에 끊겼으면(S+0x77 == 0) 진입이 팝업을 다시 띄운다 — 보상은 한 번이다
    const 안받음 = 띄우기(시즌끝선수({ seasonEndState: 128 }))
    expect(안받음.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '정규시즌우승' }, fromReentry: true })
  })

  it('이어하기 — 팝업 8 보상은 132 진입과 함께 적혀, 다시 열면 연말 이벤트로 가고 보상이 겹치지 않는다', () => {
    const 끝난대진 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, teams: [0, 1] as const, champion: 0 }
    const saveGame = 메모리저장(시즌끝선수({ gamesPlayed: 50, postseason: 끝난대진, regularSeasonRewardTaken: true, seasonEndState: 128 }))
    const 열기 = () => {
      const random = createSeededRandom(1)
      const rendered = renderHook(() => {
        const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
        const runner = useAtBatRunner()
        return { screen, setScreen, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
      })
      act(() => rendered.result.current.session.actions.continueSaved())
      return rendered
    }
    const 처음 = 열기()
    expect(처음.result.current.screen).toEqual({ kind: '포스트시즌', popup: null, fromReentry: true })
    act(() => 처음.result.current.session.actions.pressPostseason())
    act(() => 처음.result.current.session.actions.closePostseasonPopup())
    act(() => 처음.result.current.session.actions.closePostseasonPopup())
    expect(처음.result.current.session.career).toMatchObject({ popularity: 1015, reputation: 325, money: 2000, seasonEndState: 132 })

    const 다시 = 열기()
    expect(다시.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
    expect(다시.result.current.session.career).toMatchObject({ popularity: 1015, reputation: 325, money: 2000 })
  })

  it('이어하기 — 130·131 에서 끊겼으면 그 이벤트(370·375)부터 다시 튼다', () => {
    expect(띄우기(시즌끝선수({ seasonEndState: 130 })).result.current.screen).toEqual({ kind: '이벤트', eventId: 370, context: '시즌' })
    expect(띄우기(시즌끝선수({ seasonEndState: 131 })).result.current.screen).toEqual({ kind: '이벤트', eventId: 375, context: '시즌' })
  })

  it('새 시즌 처리 0x1b768 이 S+0x50 을 벗어난다 — 연봉 수락 뒤 이어하기는 관리 화면', () => {
    const rendered = 띄우기(시즌끝선수({ season: 2, seasonEndState: 132 }))
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
    이벤트보기(rendered, [380, 383])
    expect(rendered.result.current.session.career?.seasonEndState).toBeNull()
  })

  it('다른 팀 우승 — 팝업 7 만 닫고 보상 없이 연말로', () => {
    const 끝난대진 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, teams: [1, 2] as const, champion: 1 }
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 46, postseason: 끝난대진, regularSeasonRewardTaken: true }))
    이벤트보기(rendered, [376])
    act(() => rendered.result.current.session.actions.pressPostseason())
    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.session.career).toMatchObject({ popularity: 1000, reputation: 300, money: 1000 })
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
  })
})

describe('연초 115 (0x16aac) — 105 진입이 S+0x1b7 == 0 이면 내장 이벤트를 틀고 0xa4ee8 이 해제 기록을 지운다', () => {
  it('목표 창을 아직 안 봤으면 해제 기록을 비우고 115 를 연다 — 끝나면 S+0x1b7 = 1 로 해마다 한 번', async () => {
    const rendered = 띄우기({ ...createCareer('연초'), season: 2, seenEventIds: ['451'], removedMinusSkillIds: [3, 17] })
    const 세션 = () => rendered.result.current.session
    await waitFor(() => expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: NARI_YEAR_START_EVENT_ID, context: '연초' }), { timeout: 5000 })
    expect(세션().career?.removedMinusSkillIds).toEqual([])
    expect(세션().storyEvents?.some((event) => event.id === NARI_YEAR_START_EVENT_ID)).toBe(true)
    act(() => 세션().actions.completeScene([], [NARI_YEAR_START_EVENT_ID]))
    expect(세션().career?.hasSeenYearGoalWindow).toBe(true)
    // 내장 이벤트라 본 표시를 남기지 않는다
    expect(세션().career?.seenEventIds).toEqual(['451'])
    // 뒤 105 — 다시 들어온 105 가 진입 검사(자동 발동 훑기)를 잇는다. 115 는 다시 안 열린다
    expect(rendered.result.current.screen).not.toEqual(expect.objectContaining({ context: '연초' }))
  })

  it('새 선수는 오프닝 451 이 115 보다 먼저다 — 1cfa6 이 같은 틀에 115 예약을 덮는다(0x8bde0 모드 3·4 → 451)', async () => {
    const rendered = 띄우기({ ...createCareer('신인'), seenEventIds: [], hasSeenYearGoalWindow: false })
    const 세션 = () => rendered.result.current.session
    await waitFor(() => expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 451, context: '관리' }), { timeout: 5000 })
    act(() => 세션().actions.completeScene([], [451]))
    await waitFor(() => expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: NARI_YEAR_START_EVENT_ID, context: '연초' }))
  })

  it('그 해 목표 창을 이미 봤으면 115 를 열지 않고 해제 기록도 그대로다', async () => {
    const rendered = 띄우기({ ...createCareer('연중'), season: 2, seenEventIds: ['451'], removedMinusSkillIds: [3], hasSeenYearGoalWindow: true })
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull(), { timeout: 5000 })
    expect(rendered.result.current.screen).not.toEqual(expect.objectContaining({ context: '연초' }))
    expect(rendered.result.current.session.career?.removedMinusSkillIds).toEqual([3])
  })
})

describe('칭호는 관리 화면에서 하나씩 — 판정 0x1a1c0 (0x1afac) · 팝업 0x1274c · 확인 0x1b1e4', () => {
  it('들어온 관리 화면에서 처음 맞는 하나만 띄우고, 확인하면 주고 곧바로 장착한 뒤 다음 것을 띄운다', async () => {
    const rendered = 띄우기({ ...createCareer('칭호'), season: 2, gamesPlayed: 10, popularity: 4500, seenEventIds: ['451'], titleIds: [TITLE_NAMES[0]], hasSeenYearGoalWindow: true })
    const 세션 = () => rendered.result.current.session
    // 관리 화면 진입 이벤트 검사(trigger 0)는 이벤트 본문이 도착한 뒤에 돈다 — 그 뒤 두 번째 틀이 판정이다.
    // 본문이 도착한 틀(storyEvents)과 판정 틀 사이에는 효과(검사 → managementCheck = null)와 다시 그리기가 한 번씩 더 끼어
    // 부하 때 waitFor 의 50ms 검사가 그 틈에 걸리면 판정 전 값(null)을 읽었다 — 판정이 선 틀까지 기다린다
    await waitFor(() => {
      expect(세션().storyEvents).not.toBeNull()
      expect(세션().pendingTitle).not.toBeNull()
    }, { timeout: 5000 })
    // 경기 결과·훈련 같은 곳에서는 주지 않는다 — 관리 화면 갱신에서만
    expect(세션().career?.titleIds).toEqual([TITLE_NAMES[0]])
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    // 6 슈퍼 스타(인기도 2000) 가 7 월드클래스(4000) 보다 먼저다
    expect(세션().pendingTitle).toBe(TITLE_NAMES[6])
    act(() => 세션().actions.confirmTitle())
    expect(세션().career?.titleIds).toEqual([TITLE_NAMES[0], TITLE_NAMES[6]])
    expect(세션().career?.equippedTitle).toBe(6)
    expect(세션().pendingTitle).toBe(TITLE_NAMES[7])
    act(() => 세션().actions.confirmTitle())
    expect(세션().career?.equippedTitle).toBe(7)
    expect(세션().pendingTitle).toBeNull()
  })
})

describe('전역기록 +0x50(모드 4 경기 중간 저장) — 142 확인이 세우고, [14]·[최근게임] 이 곧장 경기로 연다 (0x327b8 3288e~328b4)', () => {
  const 손잡이 = () => {
    const calls: (NariGameMatch | '지움')[] = []
    const port: NariGameSavePort = { start: (match) => calls.push(match), clear: () => calls.push('지움') }
    return { calls, port }
  }
  const 띄우기2 = (saved: PlayerCareer | null, port: NariGameSavePort) => {
    const saveGame = 메모리저장(saved)
    const random = createSeededRandom(20100901)
    return renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, session: useCareerSession({ runner, random, saveGame, screen, setScreen, nariGameSave: port }) }
    })
  }

  it('142 확인 0x13cca — 굴린 마선수와 함께 +0x50 = 1, 국가대항전은 마선수 없이 S+0x12c 표시', () => {
    const { calls, port } = 손잡이()
    const rendered = 띄우기2({ ...createCareer('중간'), gamesPlayed: 4 }, port)
    act(() => rendered.result.current.session.actions.continueSaved())
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    const aces = rendered.result.current.session.matchAces
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    // 마선수는 커리어 저장의 나리 팀 레코드에 들었다 — 모드 저장 칸에는 국가대항전 여부만
    expect(aces).not.toBeNull()
    expect(calls).toEqual([{ aces: null, isNationalCup: false }])
    const 레코드 = rendered.result.current.session.career!.nariTeams!
    const 나 = 레코드[rendered.result.current.session.career!.teamId]
    expect(나.acePitcher).toBe(aces!.myPitcher)
    expect(나.batters[9]).toEqual({ slot: 12, position: 0, ace: aces!.myBatter })

    const 대회 = 손잡이()
    const cupRendered = 띄우기2(목표달성선수(), 대회.port)
    act(() => cupRendered.result.current.session.actions.continueSaved())
    act(() => cupRendered.result.current.session.actions.startCupGame({ myTeam: 10, opponent: 11 }, createNationalCup()))
    act(() => cupRendered.result.current.session.actions.confirmMatchPrepare())
    expect(대회.calls).toEqual([{ aces: null, isNationalCup: true }])
  })

  it('곧장 경기 — 저장된 선수로 142 없이 경기를 처음부터 세우고, 남겨 둔 마선수를 싣는다(굴림 없음)', () => {
    const { calls, port } = 손잡이()
    const aces = { myBatter: 0, myPitcher: 0, opponentPitcher: 2, opponentBatter: 3 }
    const rendered = 띄우기2({ ...createCareer('곧장'), gamesPlayed: 4, seasonEndState: 109 }, port)
    act(() => rendered.result.current.session.actions.resumeInterruptedGame({ aces, isNationalCup: false }))
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(rendered.result.current.session.career?.name).toBe('곧장')
    expect(rendered.result.current.session.matchAces).toEqual(aces)
    expect(rendered.result.current.session.progress?.aces?.ours).toEqual({ batter: 0, pitcher: 0 })
    expect(rendered.result.current.session.progress?.aces?.opponent).toEqual({ batter: 3, pitcher: 2 })
    // 0x327b8 의 모드 3·4 갈래는 +0x4c + 모드를 다시 쓰지 않는다 (경기 장면 셋업 0x3a342 가 같은 1)
    expect(calls).toEqual([])
  })

  it('곧장 경기 — 국가대항전(S+0x12c)이면 저장의 대회 칸 · 대표팀 칸으로 그 경기를 처음부터 다시 세운다 (0x39fdc 모드 4)', () => {
    const { calls, port } = 손잡이()
    const cup = createNationalCup()
    const saved: PlayerCareer = {
      ...createCareer('대회'),
      gamesPlayed: 45,
      nationalCup: cup,
      nariCupTeams: createNariCupTeams(0, 11),
    }
    const rendered = 띄우기2(saved, port)
    act(() => rendered.result.current.session.actions.resumeInterruptedGame({ aces: null, isNationalCup: true }))
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    // 대한민국(10) 대 그날 상대 일본(11) — 풀리그 첫날이라 대한민국이 후공
    expect(rendered.result.current.session.progress?.ourTeamId).toBe(10)
    expect(rendered.result.current.session.progress?.opponentTeamId).toBe(11)
    expect(rendered.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    // 0x327b8 는 +0x4c + 모드를 다시 쓰지 않는다
    expect(calls).toEqual([])
  })

  it('곧장 경기 — 대회 칸이 없는 옛 웹 저장의 국가대항전 경기는 이어하기로 간다', () => {
    const { port } = 손잡이()
    const rendered = 띄우기2({ ...createCareer('대회'), gamesPlayed: 4 }, port)
    act(() => rendered.result.current.session.actions.resumeInterruptedGame({ aces: null, isNationalCup: true }))
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
    expect(rendered.result.current.session.progress).toBeNull()
  })

  it('모드 초기화(나만의리그 초기화) → 모드 저장 지우기 0x224ec(저장, 4) 는 +0x50 = 0', () => {
    const { calls, port } = 손잡이()
    const rendered = 띄우기2(null, port)
    act(() => rendered.result.current.session.actions.resetCareer())
    expect(calls).toEqual(['지움'])
  })
})

describe('나리 팀 레코드로 경기를 세운다 — 0x39fdc 의 0xb891c(team[0xe + i] = i) · 벤치 +0x28c = 타자 수 − 9', () => {
  const 세우기 = (lineup?: QuickLineup) => {
    const random = createSeededRandom(77)
    const aces = { ours: { batter: 1, pitcher: 0 }, opponent: { batter: 2, pitcher: 3 } }
    const progress = startGame(random, 3, 8, 4, PLAYER_SIDE_LAST_BAT, 5, false, undefined, aces, lineup)
    return { progress, next: random.next() }
  }

  it('레코드가 예전 근사(붙박이 표 + 9번 마타자)와 같으면 경기·난수가 한 톨도 안 바뀐다', () => {
    const 근사 = 세우기()
    const 레코드 = 세우기(nariQuickLineupOf(seatAceBatter(tableNariTeamRecord(3), 1)))
    expect(레코드.progress).toEqual(근사.progress)
    expect(레코드.next).toBe(근사.next)
  })

  it('등록이 내 칸 선수를 벤치 끝으로 보낸 레코드는 벤치가 하나 많다 (CPU 대타 rand(0, 벤치 수) 범위가 는다)', () => {
    const 근사 = 세우기()
    const 레코드 = 세우기(nariQuickLineupOf(seatAceBatter(insertMyBatter(tableNariTeamRecord(3), 7), 1)))
    expect(근사.progress.ourLineup.benchBatters).toBe(4)
    expect(레코드.progress.ourLineup.benchBatters).toBe(5)
  })
})

describe('143 경기 전 엔트리 보기 — 142 위에 선다 (0x16af8 · 0x1457c, 보기 전용)', () => {
  it("142 '4' → 내 팀 레코드 · 고치지 못하고 오른 끝(3)에서 142 로, '6' → 상대 팀 · 왼 끝(2)에서 142 로", () => {
    const rendered = 띄우기({ ...createCareer('보기'), gamesPlayed: 4 })
    act(() => rendered.result.current.session.actions.runCommand('다음경기'))
    act(() => rendered.result.current.session.actions.confirmNextGameStandings())
    const 앞 = rendered.result.current.session.career
    act(() => rendered.result.current.session.actions.openEntryView(true))
    const view = rendered.result.current.session.entryView
    expect(view?.isMyTeam).toBe(true)
    expect(view?.lists.batters[7].name).toBe('보기')
    expect(rendered.result.current.screen.kind).toBe('경기준비')
    act(() => rendered.result.current.session.actions.pressEntryViewKey('확인'))
    act(() => rendered.result.current.session.actions.pressEntryViewKey('왼'))
    expect(rendered.result.current.session.entryView).not.toBeNull()
    act(() => rendered.result.current.session.actions.pressEntryViewKey('오른'))
    expect(rendered.result.current.session.entryView).toBeNull()
    expect(rendered.result.current.session.career).toEqual(앞)

    act(() => rendered.result.current.session.actions.openEntryView(false))
    expect(rendered.result.current.session.entryView?.isMyTeam).toBe(false)
    act(() => rendered.result.current.session.actions.pressEntryViewKey('오른'))
    expect(rendered.result.current.session.entryView).not.toBeNull()
    act(() => rendered.result.current.session.actions.pressEntryViewKey('왼'))
    expect(rendered.result.current.session.entryView).toBeNull()
    // 142 로 돌아와도 마선수를 다시 안 굴린다(장면+0x288) — 경기는 그대로 선다
    const aces = rendered.result.current.session.matchAces
    act(() => rendered.result.current.session.actions.confirmMatchPrepare())
    expect(rendered.result.current.session.progress?.aces?.ours).toEqual({ batter: aces?.myBatter, pitcher: aces?.myPitcher })
  })
})

describe('이어하기 S+0x50 == 2 → 116 다시 띄우기 (0x1c154 1c26a · 0x1278c — 겹쳐 쌓인다)', () => {
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
  // 116 진입이 저장한 자리 — 연속 기록 칸(안타 2개 이상 5경기 → 알림 · 평판 +10)은 정산이 이미 이었다
  const 평가중 = (): PlayerCareer => ({
    ...createCareer('평가'),
    gamesPlayed: 3,
    seasonEndState: 116,
    lastGame: 지난경기 as unknown as PlayerCareer['lastGame'],
    seasonPopularityGain: 10,
    reputation: 300,
    streaks: { multiHit: 5, homeRun: 0, hitless: 0 },
  })

  it('평가 창을 다시 띄우고 경기 뒤 카운터를 한 번 더 쓴다 — 정산(G · 평가 · 리그)은 다시 안 돈다', () => {
    const rendered = 띄우기(평가중())
    const screen = rendered.result.current.screen
    expect(screen.kind).toBe('경기결과')
    if (screen.kind !== '경기결과') return
    expect(screen.gamePointReward).toBe(0)
    expect(screen.evaluation).toEqual(지난경기.evaluation)
    expect(screen.streakNotices.map((notice) => notice.reputationChange)).toEqual([10])
    const career = rendered.result.current.session.career!
    // +0x1c2 += +0x4a (12c1e~12c30) — 한 번 더
    expect(career.seasonPopularityGain).toBe(12)
    expect(career.gamesPlayed).toBe(3)
    expect(career.reputation).toBe(300)
    expect(career.seasonEndState).toBe(116)
  })

  it('[확인] = 114 가 이벤트를 틀며 연속 기록 보상을 먹는다 — 116 에서 끊고 이어하면 카운터만 또 쌓인다', () => {
    const 첫 = 띄우기(평가중())
    act(() => 첫.result.current.session.actions.confirmGameResult())
    expect(첫.result.current.session.career?.reputation).toBe(310)
    // 114 진입이 2 → 3 으로 내리고, 관리 주기가 아니라 [114 → 109] 의 109 진입이 4 를 쓴다
    expect(첫.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
    expect(첫.result.current.session.career?.seasonEndState).toBe(109)

    // 116 에서 끊고 두 번 이어하면 카운터는 두 번 더, 보상은 마지막 114 에서 한 번
    const 둘 = 띄우기(평가중())
    const 셋 = 띄우기(둘.result.current.session.career!)
    expect(셋.result.current.session.career?.seasonPopularityGain).toBe(14)
    act(() => 셋.result.current.session.actions.confirmGameResult())
    expect(셋.result.current.session.career?.reputation).toBe(310)
    expect(셋.result.current.session.career?.seasonPopularityGain).toBe(14)
  })

  it('116 은 이 경기 홈런 > 3 이면 칭호 39 를 직접 준다(1299e) — 다시 띄워도 비트가 섰으면 안 준다', () => {
    const 홈런넷 = {
      ...평가중(),
      lastGame: { ...지난경기, summary: { ...지난경기.summary, stats: { ...지난경기.summary.stats, homeRuns: 4 } } },
    } as unknown as PlayerCareer
    const rendered = 띄우기(홈런넷)
    const screen = rendered.result.current.screen
    expect(screen.kind === '경기결과' ? screen.newTitles : null).toEqual([TITLE_NAMES[39]])
    expect(rendered.result.current.session.career?.titleIds).toContain(TITLE_NAMES[39])
    const 다시 = 띄우기(rendered.result.current.session.career!)
    const again = 다시.result.current.screen
    expect(again.kind === '경기결과' ? again.newTitles : null).toEqual([])
  })

  it('칭호 39 는 S+0x1d8[3](recordLine) 을 본다 — 포스트시즌 경기 뒤에는 앞 평가 경기 줄이다', () => {
    const 앞줄 = {
      ...평가중(),
      lastGame: { ...지난경기, recordLine: { atBats: 5, hits: 4, runsBattedIn: 6, homeRuns: 4 } },
    } as unknown as PlayerCareer
    const screen = 띄우기(앞줄).result.current.screen
    expect(screen.kind === '경기결과' ? screen.newTitles : null).toEqual([TITLE_NAMES[39]])
  })

  it('지난 경기 재료가 없는 옛 저장은 예전처럼 116 의 끝으로 가른다', () => {
    const rendered = 띄우기({ ...평가중(), lastGame: undefined })
    expect(rendered.result.current.screen).toEqual({ kind: '다음경기순위', fromManagement: false })
  })
})
