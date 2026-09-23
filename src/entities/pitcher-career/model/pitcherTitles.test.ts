import { describe, expect, it } from 'vitest'
import { createPitcherCareer, EMPTY_PITCHER_SEASON_STATS } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  awardPitcherTitles,
  evaluateNewPitcherTitles,
  equipPitcherTitle,
  nextPitcherTitleOf,
  savePointsOf,
} from '@/entities/pitcher-career/model/pitcherTitles'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_EQUIPPED_TITLE, TITLE_NAMES } from '@/entities/career/model/titles'

function 투수(
  overrides: Partial<PitcherCareer> = {},
  careerStats: Partial<PitcherSeasonStats> = {},
): PitcherCareer {
  return {
    ...createPitcherCareer('테스트'),
    ...overrides,
    careerStats: { ...EMPTY_PITCHER_SEASON_STATS, ...careerStats },
  }
}

describe('투수편 칭호 — 이름은 48~63, 비트는 타자편 32~47 과 한 벌이다 (P3 7·8절)', () => {
  it('새 투수는 "이름 없는 신인" 만 얻는다 — 공통 칭호 표를 같이 쓴다', () => {
    expect(evaluateNewPitcherTitles(투수())).toEqual(['이름 없는 신인'])
  })

  it('통산 탈삼진 사다리 — 1000 이면 초강력 탈삼진머신, 1500 이면 미스터 언터쳐블', () => {
    expect(evaluateNewPitcherTitles(투수({}, { strikeouts: 999 }))).not.toContain('초강력 탈삼진머신')
    expect(evaluateNewPitcherTitles(투수({}, { strikeouts: 1000 }))).toContain('초강력 탈삼진머신')

    const 언터쳐블 = evaluateNewPitcherTitles(투수({}, { strikeouts: 1500 }))
    expect(언터쳐블).toContain('미스터 언터쳐블')
    // 번호 순서 — 51 이 52 보다 먼저 나온다
    expect(언터쳐블.indexOf('초강력 탈삼진머신')).toBeLessThan(언터쳐블.indexOf('미스터 언터쳐블'))
  })

  it('세이브P = 세이브 + 승이고, 구원 보직만 본다 (0xb6dec)', () => {
    const 기록 = { saves: 40, wins: 10 }
    expect(savePointsOf(투수({}, 기록))).toBe(50)

    expect(evaluateNewPitcherTitles(투수({ role: PITCHER_ROLE.relief }, 기록))).toContain('떠오르는 구원왕')
    // 선발은 세이브P 칭호를 받지 못한다
    expect(evaluateNewPitcherTitles(투수({ role: PITCHER_ROLE.starter }, 기록))).not.toContain('떠오르는 구원왕')
  })

  it('승수 사다리는 선발 보직만 본다 (0x1aa8a~0x1abaa)', () => {
    expect(evaluateNewPitcherTitles(투수({ role: PITCHER_ROLE.starter }, { wins: 50 }))).toContain('떠오르는 에이스')
    expect(evaluateNewPitcherTitles(투수({ role: PITCHER_ROLE.relief }, { wins: 200 }))).not.toContain(
      '그라운드의 지배자',
    )
    expect(evaluateNewPitcherTitles(투수({ role: PITCHER_ROLE.starter }, { wins: 200 }))).toContain(
      '그라운드의 지배자',
    )
  })

  it('미스터 제로는 6년차 18경기째에만 통산 방어율 0.99 이하를 본다 (0x1ac60)', () => {
    // 아웃 900 · 실점 33 → 33×2700/900 = 99 (0.99)
    const 짠물 = { outs: 900, runsAllowed: 33 }
    const 한점더 = { outs: 900, runsAllowed: 34 }

    expect(evaluateNewPitcherTitles(투수({ season: 6, gamesPlayed: 18 }, 짠물))).toContain('미스터 제로')
    expect(evaluateNewPitcherTitles(투수({ season: 6, gamesPlayed: 18 }, 한점더))).not.toContain('미스터 제로')
    // 그 순간이 아니면 보지 않는다
    expect(evaluateNewPitcherTitles(투수({ season: 6, gamesPlayed: 19 }, 짠물))).not.toContain('미스터 제로')
    expect(evaluateNewPitcherTitles(투수({ season: 7, gamesPlayed: 18 }, 짠물))).not.toContain('미스터 제로')
  })

  it('통산 아웃이 0 이면 실점도 0 일 때만 미스터 제로다 (0x1acd6)', () => {
    expect(evaluateNewPitcherTitles(투수({ season: 6, gamesPlayed: 18 }, { outs: 0, runsAllowed: 0 }))).toContain(
      '미스터 제로',
    )
    expect(evaluateNewPitcherTitles(투수({ season: 6, gamesPlayed: 18 }, { outs: 0, runsAllowed: 1 }))).not.toContain(
      '미스터 제로',
    )
  })

  it('닥터 K 는 스킬 비트 11 — 투수 스킬 비트는 표 번호 − 16 이라 표 27 "닥터K" 다', () => {
    expect(evaluateNewPitcherTitles(투수({ skillIds: [11] }))).toContain('닥터 K')
    expect(evaluateNewPitcherTitles(투수({ skillIds: [27] }))).not.toContain('닥터 K')
  })

  it('MVP 칭호는 타자편 32·33 과 같은 식이고 이름만 투수편이다', () => {
    expect(evaluateNewPitcherTitles(투수({ mvpSeasonBits: 0b11, season: 3, gamesPlayed: 0 }))).toContain('괴물 투수')
    expect(evaluateNewPitcherTitles(투수({ mvpSeasonBits: 0b1111, season: 5, gamesPlayed: 0 }))).toContain('국민 투수')
    // 타자편 이름은 쓰지 않는다
    expect(evaluateNewPitcherTitles(투수({ mvpSeasonBits: 0b11, season: 3, gamesPlayed: 0 }))).not.toContain('괴물 타자')
  })

  it('제구·구속·변화가 모두 999 면 초음속 폭격기 — 체력은 보지 않는다 (0x1ad7e)', () => {
    const 만렙 = { control: 999, velocity: 999, breaking: 999, stamina: 1 }

    expect(evaluateNewPitcherTitles(투수({ ability: 만렙 }))).toContain('초음속 폭격기')
    expect(evaluateNewPitcherTitles(투수({ ability: { ...만렙, breaking: 998 } }))).not.toContain('초음속 폭격기')
  })

  it('마구 4단계를 다 배우면 마탄의 투수다 (0x1ae04 — +0x201 > 3, 근사다)', () => {
    expect(evaluateNewPitcherTitles(투수({ magicLevel: 3 }))).not.toContain('마탄의 투수')
    expect(evaluateNewPitcherTitles(투수({ magicLevel: 4 }))).toContain('마탄의 투수')
  })

  it('공통 칭호는 타자편과 같은 값을 본다 — 연애 이벤트·우승·평판', () => {
    expect(evaluateNewPitcherTitles(투수({ seenEventIds: ['300', '301'] }))).toEqual(
      expect.arrayContaining(['간호사 페티쉬', '와일드 씽씽이', '사랑에 빠진 남자']),
    )
    expect(evaluateNewPitcherTitles(투수({ regularSeasonFirstCount: 5 }))).toContain('우승청부업자')
    expect(evaluateNewPitcherTitles(투수({ reputation: 999 }))).toContain('성스러운 영혼')
  })

  it('투수편 이름은 모두 표의 48~63 칸에서 온다', () => {
    const 이름들 = evaluateNewPitcherTitles(
      투수({ role: PITCHER_ROLE.starter, magicLevel: 4 }, { strikeouts: 1500, wins: 200 }),
    )
    const 투수전용 = 이름들.filter((이름) => TITLE_NAMES.indexOf(이름) >= 32)

    expect(투수전용.length).toBeGreaterThan(0)
    expect(투수전용.every((이름) => TITLE_NAMES.indexOf(이름) >= 48)).toBe(true)
  })

  it('이미 가진 칭호는 다시 주지 않고, nextPitcherTitleOf 는 하나만 준다', () => {
    const 신인 = 투수()
    expect(nextPitcherTitleOf(신인)).toBe('이름 없는 신인')

    const 받은뒤 = awardPitcherTitles(신인, evaluateNewPitcherTitles(신인))
    expect(evaluateNewPitcherTitles(받은뒤)).toEqual([])
    expect(nextPitcherTitleOf(받은뒤)).toBeNull()
    expect(awardPitcherTitles(받은뒤, [])).toBe(받은뒤)
  })
})

describe('장착 칭호 — 선수 +0x1c4 (P3 10-1)', () => {
  it('새 투수는 장착한 것이 없다 (−1)', () => {
    expect(투수().equippedTitle).toBe(NO_EQUIPPED_TITLE)
  })

  it('얻으면 곧바로 장착한다 (0x1b214) — 여럿이면 **번호가 가장 큰 것**이 남는다', () => {
    const 신인 = 투수()

    const 받은뒤 = awardPitcherTitles(신인, ['이름 없는 신인'])
    expect(받은뒤.equippedTitle).toBe(0)

    // 타자편 `awardTitles` 와 같은 규칙 — 번호 오름차순으로 이어 주면 마지막이 가장 큰 번호다
    const 에이스 = awardPitcherTitles(받은뒤, ['떠오르는 에이스', '초강력 탈삼진머신'])
    expect(TITLE_NAMES[에이스.equippedTitle]).toBe('떠오르는 에이스')
  })

  it('129 확인 — 고른 번호를 +0x1c4 에 넣고, 이미 장착한 것이면 아무 일도 없다', () => {
    const 신인 = awardPitcherTitles(투수(), ['이름 없는 신인', '닥터 K'])

    const 바꾼뒤 = equipPitcherTitle(신인, '이름 없는 신인')
    expect(TITLE_NAMES[바꾼뒤.equippedTitle]).toBe('이름 없는 신인')
    expect(equipPitcherTitle(바꾼뒤, '이름 없는 신인')).toBe(바꾼뒤)
    // 표에 없는 이름은 무시한다
    expect(equipPitcherTitle(바꾼뒤, '없는칭호')).toBe(바꾼뒤)
  })
})
