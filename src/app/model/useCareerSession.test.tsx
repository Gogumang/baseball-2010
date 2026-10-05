// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyGameEvaluation, isEvaluatedGame, useCareerSession } from '@/app/model/useCareerSession'
import { EMPTY_LEAGUE, LEAGUE_TEAM_COUNT, startPostseason } from '@/entities/league/model/league'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { SALARY_ACCEPT_EVENT_ID } from '@/entities/career/model/seasonFlow'
import { careerNationalCupRewardOf } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { gamePointRewardOf } from '@/entities/career/model/playerCareer'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { summaryOf } from '@/features/play-game/model/gameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'

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
    act(() => rendered.result.current.session.actions.finishLoading())
    return rendered
  }
  /** 반 이닝 시뮬레이션이 남기는 수비 기록(16~)은 빼고 연속 파울 둘만 본다 */
  const 파울기록 = (recordIds: readonly number[] | undefined) =>
    (recordIds ?? []).filter((id) => id === 32 || id === 33)
  const 던지기 = (rendered: ReturnType<typeof 경기띄우기>, pitches: readonly PitchOutcomeDetail[]) => {
    for (const pitch of pitches) act(() => rendered.result.current.session.handlePitchResolved(pitch))
  }

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
    const random = createSeededRandom(20100901)
    const rendered = renderHook(() => {
      const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
      const runner = useAtBatRunner()
      return { screen, runner, session: useCareerSession({ runner, random, saveGame, screen, setScreen }) }
    })
    try {
      act(() => rendered.result.current.session.actions.continueSaved())
      act(() => rendered.result.current.session.actions.runCommand('다음경기'))
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
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '정규시즌우승' } })

    // 팝업이 떠 있으면 키가 안 먹는다
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.session.career?.postseason?.round).toBe('준플레이오프')

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null })
    expect(rendered.result.current.session.career).toMatchObject({
      popularity: 1010,
      money: 1500,
      regularSeasonRewardTaken: true,
    })
  })

  it('[확인] — CPU 끼리 내 차례(1위는 한국시리즈)까지 돌고 머물렀다가, 다음 [확인]에 내 경기를 연다', () => {
    const rendered = 띄우기(시즌끝선수({ regularSeasonRewardTaken: true }))
    이벤트보기(rendered, [376])
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null })

    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null })
    const series = rendered.result.current.session.career?.postseason
    expect(series?.round).toBe('한국시리즈')
    expect(series?.teams[0]).toBe(0)

    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '경기' })
    expect(rendered.result.current.session.progress?.opponentTeamId).toBe(series?.teams[1])
  })

  it('홈/원정은 0xb7844 포스트시즌 갈래 — 대진 윗 시드(칸 0)가 후공, 아랫 시드는 선공이다', () => {
    // 준PO 는 3위(2) 대 4위(3) — 4위는 아랫 시드라 선공
    const 아랫시드 = 띄우기(시즌끝선수({ teamId: 3, gamesPlayed: 46, regularSeasonRewardTaken: true }))
    act(() => 아랫시드.result.current.session.actions.confirmGameResult())
    act(() => 아랫시드.result.current.session.actions.pressPostseason())
    expect(아랫시드.result.current.screen).toEqual({ kind: '경기' })
    expect(아랫시드.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)

    const 윗시드 = 띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 46, regularSeasonRewardTaken: true }))
    act(() => 윗시드.result.current.session.actions.confirmGameResult())
    act(() => 윗시드.result.current.session.actions.pressPostseason())
    expect(윗시드.result.current.session.progress?.game.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
  })

  it('포스트시즌 날짜 카운터 g 는 시리즈 안 경기 수다 (L+0x32 — 0xb80a8 0 · 0xb7724 −1 · 0xb818c +1)', () => {
    // 준PO 3위(2) 대 4위(3), 1승 1패 뒤 셋째 경기 — g = 2. 커리어 경기 수(47)는 g 가 아니다
    const 대진 = { ...startPostseason([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), wins: [1, 1] as [number, number] }
    const rendered = 띄우기(시즌끝선수({ teamId: 2, gamesPlayed: 47, postseason: 대진, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.session.progress?.ourStartingPitcherIndex).toBe(2)
    expect(rendered.result.current.session.progress?.opponentStartingPitcherIndex).toBe(2)
  })

  it('포스트시즌 경기 결과 [확인] 은 관리 주기 대신 대진 128 로 돌아간다', () => {
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 47, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: null })
  })

  it('내 팀 우승 — 팝업 7 [137] → 팝업 8 [190] 보상 → 연말(132) 이벤트', () => {
    const 끝난대진 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, teams: [0, 1] as const, champion: 0 }
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 50, postseason: 끝난대진, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    act(() => rendered.result.current.session.actions.pressPostseason())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '우승발표', champion: 0 } })

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.screen).toEqual({ kind: '포스트시즌', popup: { kind: '한국시리즈우승' } })

    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.session.career).toMatchObject({ popularity: 1015, reputation: 325, money: 2000 })
    // 1년차 연말은 연봉협상 380
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
  })

  it('다른 팀 우승 — 팝업 7 만 닫고 보상 없이 연말로', () => {
    const 끝난대진 = { ...startPostseason([0, 1, 2, 3]), round: '종료' as const, teams: [1, 2] as const, champion: 1 }
    const rendered = 띄우기(시즌끝선수({ gamesPlayed: 46, postseason: 끝난대진, regularSeasonRewardTaken: true }))
    act(() => rendered.result.current.session.actions.confirmGameResult())
    act(() => rendered.result.current.session.actions.pressPostseason())
    act(() => rendered.result.current.session.actions.closePostseasonPopup())
    expect(rendered.result.current.session.career).toMatchObject({ popularity: 1000, reputation: 300, money: 1000 })
    expect(rendered.result.current.screen).toEqual({ kind: '이벤트', eventId: 380, context: '시즌' })
  })
})
