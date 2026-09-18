import { describe, expect, it } from 'vitest'
import { applyGameResult, createCareer, gamePointRewardOf, nameByteLengthOf, rookieAbilityOf, startNextSeason } from '@/entities/career/model/playerCareer'
import { EMPTY_LEAGUE } from '@/entities/league/model/league'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import type { GameSummary } from '@/entities/game/model/gameSummary'

describe('신인 초기값 — 0x11244', () => {
  it('인기도 0 · 평판 300 · 사기 100 · 소지금 6000만 · 연봉 50 으로 시작한다', () => {
    const career = createCareer('신인')

    expect({
      popularity: career.popularity,
      reputation: career.reputation,
      morale: career.morale,
      money: career.money,
      salary: career.salary,
    }).toEqual({ popularity: 0, reputation: 300, morale: 100, money: 6000, salary: 50 })
  })

  it('시작 능력치는 표 0xcc3fa 의 타입 값에 수비(목록 B=0) 또는 주루(B≠0) +30 이다 (0x16e2c)', () => {
    expect(rookieAbilityOf(0, 0)).toEqual({ hit: 100, power: 100, defense: 130, run: 100 })
    expect(rookieAbilityOf(1, 1)).toEqual({ hit: 80, power: 150, defense: 80, run: 110 })
    expect(createCareer('신인').ability).toEqual(rookieAbilityOf(0, 0))
  })

  it('등록 화면에서 고른 타입·포지션·손을 반영한다 (0x16f28)', () => {
    const career = createCareer('신인', { battingTypeIndex: 1, positionIndex: 1, battingSide: 1, skinIndex: 2 })

    expect(career.ability).toEqual(rookieAbilityOf(1, 1))
    expect([career.battingTypeIndex, career.positionIndex, career.battingSide, career.skinIndex]).toEqual([1, 1, 1, 2])
  })

  it('이름은 한글 4글자·영문 8글자 = 8바이트까지다 (StrMODE[3], 한글 2바이트)', () => {
    expect([nameByteLengthOf('홍길동이'), nameByteLengthOf('ABCDEFGH'), nameByteLengthOf('홍a')]).toEqual([8, 8, 3])
  })

  it('스킬 0 "병아리" 와 8 "의외성" 을 갖고 시작한다 (0x11230, 점검 9차)', () => {
    expect(createCareer('신인').skillIds).toEqual([0, 8])
  })
})

describe('리그 전적 — 0xb76dc · 0xb77e0', () => {
  const 경기 = (overrides = {}) =>
    ({ result: '승', stats: EMPTY_SEASON_STATS, recordIds: [], ourTeamId: 0, opponentTeamId: 3, ...overrides }) as unknown as GameSummary

  it('내 팀 경기 결과를 승·패에 넣는다 — 무승부는 어느 쪽도 세지 않는다', () => {
    const 이김 = applyGameResult(createCareer('선수'), 경기())
    expect([이김.league.wins[0], 이김.league.losses[3]]).toEqual([1, 1])

    const 짐 = applyGameResult(createCareer('선수'), 경기({ result: '패' }))
    expect([짐.league.wins[3], 짐.league.losses[0]]).toEqual([1, 1])

    expect(applyGameResult(createCareer('선수'), 경기({ result: '무' })).league).toEqual(EMPTY_LEAGUE)
  })
})

describe('새 시즌 전환 — 0x1b768', () => {
  it('사기를 100 으로 되돌리고 연봉(100만 단위)을 소지금(만원)에 더한다', () => {
    const next = startNextSeason({ ...createCareer('선수'), morale: 20, money: 1000, salary: 50 })

    expect(next.morale).toBe(100)
    expect(next.money).toBe(1000 + 5000)
  })

  it('소지금은 9999×100만 을 넘지 않는다', () => {
    expect(startNextSeason({ ...createCareer('선수'), money: 999_000, salary: 100 }).money).toBe(999_900)
  })
})

describe('경기 끝 G포인트 — 0x4ea0c', () => {
  it('달성 기록 금액의 합이고 출전·승리 보너스는 없다', () => {
    const summary = { result: '승', recordIds: [0, 15] } as unknown as GameSummary

    expect(gamePointRewardOf(summary)).toBe(110)
    expect(gamePointRewardOf({ ...summary, recordIds: [] })).toBe(0)
  })
})
