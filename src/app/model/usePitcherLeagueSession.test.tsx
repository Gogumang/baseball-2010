// @vitest-environment jsdom
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { NO_EQUIPPED_TITLE } from '@/entities/career/model/titles'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

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
    evaluation: { popularityChange: 0, reputationChange: 0, moraleChange: 0 },
  } as unknown as Parameters<ReturnType<typeof 띄우기>['result']['current']['actions']['finishGame']>[0]

  const 경기치르기 = (result: ReturnType<typeof 띄우기>['result']) => {
    act(() => result.current.actions.beginGame())
    act(() => result.current.actions.finishGame(경기요약))
  }

  type 커리어 = Parameters<ReturnType<typeof 띄우기>['result']['current']['actions']['save']>[0]

  const 판짜기 = (career: Partial<커리어>) => {
    const { result } = 띄우기()
    act(() => result.current.actions.create('투수', 신인))
    act(() => result.current.actions.save({ ...result.current.career!, ...career }))
    return result
  }

  it('45경기째를 치르면 정규시즌이 닫히고 시즌종료 화면으로 간다 (0xb818c)', () => {
    const result = 판짜기({ gamesPlayed: 44 })

    경기치르기(result)

    expect(result.current.career?.gamesPlayed).toBe(45)
    expect(result.current.scene).toBe('시즌종료')
    // 정규시즌이 닫히면 포스트시즌 대진이 선다
    expect(result.current.career?.postseason).not.toBeNull()
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
    // 109 순위표 화면이 웹에 없어 타자편과 같이 곧바로 다음 경기다
    expect(홀수.current.scene).toBe('경기')
    expect(홀수.current.gameOptions?.dayCounter).toBe(11)
  })

  it('1~6년차 연말은 새 시즌으로 이어진다 — 성적이 비고 연차가 오른다', () => {
    const result = 판짜기({ season: 3, gamesPlayed: 45 })

    act(() => result.current.actions.beginYearEnd())

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(4)
    expect(result.current.career?.gamesPlayed).toBe(0)
  })

  it('7년차 인기도 499 이하면 연말이 곧 방출 엔딩(1)이다', () => {
    const result = 판짜기({ season: 7, gamesPlayed: 45, popularity: 400 })

    act(() => result.current.actions.beginYearEnd())

    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(1)
  })

  it('7~12년차 연말은 은퇴 선택(502)이 뜨고, 은퇴를 고르면 엔딩으로 간다', () => {
    const result = 판짜기({ season: 9, gamesPlayed: 45, popularity: 1600, gamePoint: 0 })

    act(() => result.current.actions.beginYearEnd())
    expect(result.current.scene).toBe('연말')

    act(() => result.current.actions.retire())

    expect(result.current.scene).toBe('엔딩')
    expect(result.current.career?.endingIndex).toBe(5)
    // 엔딩 보너스 0xcc40c[5] = 12000 G 를 띄울 때 준다 (0x1220c)
    expect(result.current.career?.gamePoint).toBe(12_000)
  })

  it('은퇴 선택에서 연봉협상을 고르면 다음 연차로 이어진다', () => {
    const result = 판짜기({ season: 9, gamesPlayed: 45, popularity: 1600 })
    act(() => result.current.actions.beginYearEnd())

    act(() => result.current.actions.continueCareer())

    expect(result.current.scene).toBe('관리')
    expect(result.current.career?.season).toBe(10)
  })

  it('마지막 해(13년차)는 연말이 반드시 엔딩이다 (은퇴식 504)', () => {
    const result = 판짜기({ season: 13, gamesPlayed: 45, popularity: 1600 })

    act(() => result.current.actions.beginYearEnd())

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
    it('관리 화면에서 조건을 채우면 계열이 열린다 (30 → 행1)', () => {
      const result = 판짜기({
        season: 5,
        gamesPlayed: 10,
        ability: { control: 200, velocity: 250, breaking: 300, stamina: 100 },
      })

      expect(result.current.career?.hiddenPitchRows[1]).toBe(true)
      expect(result.current.career?.seenEventIds).toContain('30')
      // 조건을 덜 채운 31~33 은 아직 잠겨 있다
      expect(result.current.career?.hiddenPitchRows[2]).toBe(false)
      expect(result.current.career?.hiddenPitchRows[0]).toBe(false)
    })

    it('조건을 채운 것이 여럿이면 하나씩 연달아 열린다 (A 3절)', () => {
      const result = 판짜기({
        season: 7,
        gamesPlayed: 10,
        ability: { control: 300, velocity: 400, breaking: 600, stamina: 100 },
      })

      expect(result.current.career?.hiddenPitchRows).toEqual([false, true, true, true])
      expect(result.current.career?.seenEventIds).toEqual(['30', '31', '32'])
    })

    it('조건을 못 채우면 열리지 않는다', () => {
      const result = 판짜기({
        season: 5,
        gamesPlayed: 10,
        ability: { control: 200, velocity: 250, breaking: 299, stamina: 100 },
      })

      expect(result.current.career?.hiddenPitchRows).toEqual([false, false, false, false])
    })
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
