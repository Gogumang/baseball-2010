// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SALARY_ACCEPT_EVENT_ID } from '@/entities/career/model/seasonFlow'
import { careerNationalCupRewardOf } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'

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

    const 거절 = 띄우기(목표달성선수())
    연봉사슬끝내기(거절)
    이벤트보기(거절, [461, 464])

    expect(거절.result.current.screen).toEqual({ kind: '관리' })
    expect(거절.result.current.session.career?.season).toBe(2)
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
  it('매치업에서 경기를 시작하면 대한민국으로 경기 화면에 들어간다', () => {
    const rendered = 띄우기(목표달성선수())
    연봉사슬끝내기(rendered)
    이벤트보기(rendered, [461, 463])

    act(() =>
      rendered.result.current.session.actions.startCupGame({ myTeam: 10, opponent: 11 }, createNationalCup()),
    )

    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(rendered.result.current.session.progress?.ourTeamId).toBe(10)
    expect(rendered.result.current.session.progress?.opponentTeamId).toBe(11)
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
