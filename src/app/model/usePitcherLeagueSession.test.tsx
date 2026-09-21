// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
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

  it('45경기 전에는 관리 화면으로 돌아간다', () => {
    const result = 판짜기({ gamesPlayed: 10 })

    경기치르기(result)

    expect(result.current.scene).toBe('관리')
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

  it('부상으로 20경기를 뛰면 경기 뒤 곧바로 부상 엔딩(0)이다 (B-7)', () => {
    const result = 판짜기({ gamesPlayed: 10, isInjured: true, injuredGamesPlayed: 19 })

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

  it('이름이 없는 값은 커리어로 보지 않는다', () => {
    const store = 메모리저장()
    store.save({ teamId: 1 } as object)

    expect(띄우기(store).result.current.career).toBeNull()
  })
})
