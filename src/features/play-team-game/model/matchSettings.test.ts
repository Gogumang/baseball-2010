import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import {
  CHANCE_VALUE,
  FULL_PLAY_SETTINGS,
  INNING_VALUE,
  MATCH_SETTING_KIND,
  hasAnyDetailSelection,
  isHumanControlled,
} from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'

const 빈설정: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.찬스,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

const 루 = (options: Partial<BaseState>): BaseState => ({ ...EMPTY_BASES, ...options })

const 상황 = (options: {
  offense?: boolean
  bases?: BaseState
  inningIndex?: number
  battingOrderIndex?: number
  mode?: number
}) => ({
  mode: options.mode ?? 2,
  humanControlsOffense: options.offense ?? true,
  humanControlsDefense: !(options.offense ?? true),
  bases: options.bases ?? EMPTY_BASES,
  inningIndex: options.inningIndex ?? 0,
  battingOrderIndex: options.battingOrderIndex ?? 0,
})

describe('경기진행 설정 — 찬스 (0xc1e04, V5 정정)', () => {
  const 공격찬스 = { ...빈설정, value: CHANCE_VALUE.공격득점권 }
  const 수비위기 = { ...빈설정, value: CHANCE_VALUE.수비삼루 }

  it('값 0 은 **사람이 공격 중**이고 2루 또는 3루에 주자가 있을 때만 조작한다', () => {
    expect(isHumanControlled(공격찬스, 상황({ offense: true, bases: 루({ second: true }) }))).toBe(true)
    expect(isHumanControlled(공격찬스, 상황({ offense: true, bases: 루({ third: true }) }))).toBe(true)
    expect(isHumanControlled(공격찬스, 상황({ offense: true, bases: 루({ first: true }) }))).toBe(false)
    expect(isHumanControlled(공격찬스, 상황({ offense: true }))).toBe(false)
  })

  it('값 0 은 사람이 수비 중이면 주자가 있어도 자동이다 (보는 쪽이 공격 팀이다)', () => {
    expect(isHumanControlled(공격찬스, 상황({ offense: false, bases: 루({ second: true, third: true }) }))).toBe(false)
  })

  it('값 1 은 **사람이 수비 중**이고 3루에 주자가 있을 때만 조작한다', () => {
    expect(isHumanControlled(수비위기, 상황({ offense: false, bases: 루({ third: true }) }))).toBe(true)
    expect(isHumanControlled(수비위기, 상황({ offense: false, bases: 루({ second: true }) }))).toBe(false)
    expect(isHumanControlled(수비위기, 상황({ offense: true, bases: 루({ third: true }) }))).toBe(false)
  })
})

describe('경기진행 설정 — 이닝', () => {
  it('값 0 "자동진행 없음" 은 공수 어느 쪽이든 늘 조작한다', () => {
    const 전체 = { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.전체 }
    expect(isHumanControlled(전체, 상황({ offense: true }))).toBe(true)
    expect(isHumanControlled(전체, 상황({ offense: false }))).toBe(true)
  })

  it('값 1 "3이닝 자동진행" 은 이닝idx > 2 = **4회부터**', () => {
    const 넷째 = { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.넷째이닝부터 }
    expect(isHumanControlled(넷째, 상황({ inningIndex: 2 }))).toBe(false)
    expect(isHumanControlled(넷째, 상황({ inningIndex: 3 }))).toBe(true)
  })

  it('값 2 "6이닝 자동진행" 은 이닝idx > 5 = **7회부터**', () => {
    const 일곱째 = { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.일곱째이닝부터 }
    expect(isHumanControlled(일곱째, 상황({ inningIndex: 5 }))).toBe(false)
    expect(isHumanControlled(일곱째, 상황({ inningIndex: 6 }))).toBe(true)
  })
})

describe('경기진행 설정 — 상세', () => {
  it('공격 가지는 타순 비트와 공격주자 비트를 본다', () => {
    const 설정 = {
      ...빈설정,
      kind: MATCH_SETTING_KIND.상세,
      battingOrderBits: 0b0000_0100, // 3번 타순
      offenseRunnerBits: 0b100, // 3루
    }
    expect(isHumanControlled(설정, 상황({ offense: true, battingOrderIndex: 2 }))).toBe(true)
    expect(isHumanControlled(설정, 상황({ offense: true, battingOrderIndex: 1 }))).toBe(false)
    expect(
      isHumanControlled(설정, 상황({ offense: true, battingOrderIndex: 1, bases: 루({ third: true }) })),
    ).toBe(true)
  })

  it('수비 가지는 이닝 비트와 수비주자 비트를 본다', () => {
    const 설정 = {
      ...빈설정,
      kind: MATCH_SETTING_KIND.상세,
      pitchingInningBits: 0b0000_0001, // 1회
      defenseRunnerBits: 0b010, // 2루
    }
    expect(isHumanControlled(설정, 상황({ offense: false, inningIndex: 0 }))).toBe(true)
    expect(isHumanControlled(설정, 상황({ offense: false, inningIndex: 1 }))).toBe(false)
    expect(
      isHumanControlled(설정, 상황({ offense: false, inningIndex: 1, bases: 루({ second: true }) })),
    ).toBe(true)
  })

  it('투수조작 칸 8 은 9회부터 **연장까지 전부** 덮는다 (R4 4절 확정)', () => {
    const 설정 = { ...빈설정, kind: MATCH_SETTING_KIND.상세, pitchingInningBits: 1 << 8 }
    expect(isHumanControlled(설정, 상황({ offense: false, inningIndex: 7 }))).toBe(false)
    expect(isHumanControlled(설정, 상황({ offense: false, inningIndex: 8 }))).toBe(true)
    expect(isHumanControlled(설정, 상황({ offense: false, inningIndex: 11 }))).toBe(true)
  })

  it('최소 한 항목 검사 (StrMAINMENU[126])', () => {
    expect(hasAnyDetailSelection({ ...빈설정, kind: MATCH_SETTING_KIND.상세 })).toBe(false)
    expect(hasAnyDetailSelection({ ...빈설정, kind: MATCH_SETTING_KIND.상세, defenseRunnerBits: 1 })).toBe(true)
  })
})

describe('모드별 분기', () => {
  it('대전(8·9)은 이닝idx ≤ 5 일 때만 설정을 본다 — 그 밖은 사람 조작 (추정)', () => {
    const 찬스 = { ...빈설정, value: CHANCE_VALUE.공격득점권 }
    expect(isHumanControlled(찬스, 상황({ mode: 8, inningIndex: 5 }))).toBe(false)
    expect(isHumanControlled(찬스, 상황({ mode: 8, inningIndex: 6 }))).toBe(true)
    expect(isHumanControlled(찬스, 상황({ mode: 9, inningIndex: 6 }))).toBe(true)
  })

  it('팀 경기가 아닌 모드는 이 분기를 아예 타지 않는다 (상황 0·1·7·8 만)', () => {
    const 찬스 = { ...빈설정, value: CHANCE_VALUE.공격득점권 }
    expect(isHumanControlled(찬스, 상황({ mode: 4 }))).toBe(true)
  })

  it('웹판 기본값은 "모든 이닝을 직접 플레이" 다', () => {
    expect(isHumanControlled(FULL_PLAY_SETTINGS, 상황({ offense: false, inningIndex: 0 }))).toBe(true)
  })
})
