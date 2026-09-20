import { describe, expect, it } from 'vitest'
import {
  ACE_CHALLENGE_MISSIONS,
  BATTER_MISSIONS,
  createProgress,
  goalNamesFor,
  goalsOf,
  isCleared,
  isEveryMissionCleared,
  missionKeyOf,
  recordOutcome,
  requiredCountOf,
  PITCHER_MISSIONS,
  pitcherGoalNamesFor,
  recordPitcherOutcome,
} from '@/entities/mission/model/missionGoal'
import { MISSIONS } from '@/shared/config/original/missions'

const 첫걸음 = MISSIONS.find((m) => m.name === '명품 타자의 첫 걸음')!
const 번트달인 = MISSIONS.find((m) => m.name === '번트의 달인')!
const 사이클링 = MISSIONS.find((m) => m.name.includes('사이클링'))!

describe('원본 미션 데이터', () => {
  it('원본 레코드는 38개, 목록은 편마다 14개다', () => {
    expect(MISSIONS).toHaveLength(38)
    // 설명서 StrHOWTO[27] "총 28개의 미션" — 단계 0 인 마선수 공략 레코드 5+5개는 목록에 없다
    expect(BATTER_MISSIONS).toHaveLength(14)
    expect(ACE_CHALLENGE_MISSIONS).toHaveLength(10)
  })

  it('원작 미션 이름이 들어있다', () => {
    const names = MISSIONS.map((m) => m.name)

    expect(names).toContain('명품 타자의 첫 걸음')
    expect(names).toContain('번트의 달인')
    expect(names).toContain('도전! 노히트 노런')
    expect(names).toContain('밀림의 공주 레오니')
  })

  it('마선수 공략 미션이 타자편·투수편에 5개씩 있다', () => {
    const aceNames = ['싸이커', '레오니', '붕붕머신', '발렌타인', '드래고나']
    const 공략 = MISSIONS.filter((m) => aceNames.includes(m.name))

    expect(공략).toHaveLength(5)
  })

  it('제한 시간이 있는 미션이 존재한다', () => {
    expect(MISSIONS.some((m) => m.timeLimitSeconds > 0)).toBe(true)
  })

  it('모든 미션에 목표와 설명문이 있다', () => {
    const 빈미션 = MISSIONS.filter((m) => m.goals.length === 0 || m.briefing === '')

    expect(빈미션.map((m) => m.name)).toEqual([])
  })
})

describe('requiredCountOf — 설명문에서 목표 수를 읽는다', () => {
  it('"2안타와 1타점을 올리자!" 에서 안타 2, 타점 1을 읽는다', () => {
    expect(requiredCountOf(첫걸음, '안타')).toBe(2)
    expect(requiredCountOf(첫걸음, '타점')).toBe(1)
  })

  it('숫자가 없으면 1개로 본다', () => {
    expect(requiredCountOf(번트달인, '번트')).toBe(1)
  })
})

describe('goalNamesFor', () => {
  it('2루타는 안타와 2루타 둘 다에 해당한다', () => {
    expect(goalNamesFor({ kind: '안타', bases: 2 }, 0)).toEqual(['안타', '2루타'])
  })

  it('홈런은 안타에도 홈런에도 해당한다', () => {
    // 그라운드홈런은 원본이 홈런 쪽에서 센다 (0xaa0a8, E-8) — 수비 시뮬이 없어 모든 홈런을 함께 센다
    expect(goalNamesFor({ kind: '홈런' }, 1)).toEqual(['안타', '홈런', '그라운드홈런', '타점'])
    expect(goalNamesFor({ kind: '홈런' }, 4, false, 3)).toEqual(['안타', '홈런', '그라운드홈런', '만루홈런', '타점'])
  })

  it('타점이 있으면 타점 목표가 잡힌다', () => {
    expect(goalNamesFor({ kind: '안타', bases: 1 }, 2)).toContain('타점')
  })

  it('아웃은 아무 목표에도 해당하지 않는다', () => {
    expect(goalNamesFor({ kind: '아웃', detail: '땅볼아웃' }, 0)).toEqual([])
  })
})

describe('미션 진행', () => {
  it('안타 2개와 타점 1개를 올리면 첫 미션이 클리어된다', () => {
    let progress = createProgress()
    progress = recordOutcome(progress, { kind: '안타', bases: 1 }, 0)
    expect(isCleared(첫걸음, progress)).toBe(false)

    progress = recordOutcome(progress, { kind: '안타', bases: 1 }, 1)

    expect(isCleared(첫걸음, progress)).toBe(true)
  })

  it('타점은 들어온 점수만큼 쌓인다', () => {
    const progress = recordOutcome(createProgress(), { kind: '홈런' }, 3)

    expect(progress.counts['타점']).toBe(3)
  })

  it('목표 진행도를 필요 수와 함께 알려준다', () => {
    const progress = recordOutcome(createProgress(), { kind: '안타', bases: 1 }, 0)

    expect(goalsOf(첫걸음, progress)).toEqual([
      { name: '안타', required: 2, achieved: 1 },
      { name: '타점', required: 1, achieved: 0 },
    ])
  })

  it('여러 목표 중 하나만 채우면 클리어가 아니다', () => {
    let progress = createProgress()
    for (let i = 0; i < 4; i += 1) {
      progress = recordOutcome(progress, { kind: '안타', bases: 1 }, 0)
    }

    expect(isCleared(첫걸음, progress)).toBe(false)
  })

  it('타석 수가 누적된다', () => {
    const progress = recordOutcome(createProgress(), { kind: '삼진' }, 0)

    expect(progress.plateAppearances).toBe(1)
  })

  it('사이클링 히트는 단타·2루타·3루타·홈런 네 가지를 모두 쳐야 한다', () => {
    let progress = createProgress()
    progress = recordOutcome(progress, { kind: '홈런' }, 1)
    progress = recordOutcome(progress, { kind: '홈런' }, 1)
    progress = recordOutcome(progress, { kind: '안타', bases: 2 }, 0)
    progress = recordOutcome(progress, { kind: '안타', bases: 1 }, 0)

    expect(goalsOf(사이클링, progress)).toEqual([{ name: '사이클링히트', required: 4, achieved: 3 }])
    expect(isCleared(사이클링, progress)).toBe(false)
    expect(사이클링.timeLimitSeconds).toBe(120)
  })

  it('입력 진행도를 변경하지 않는다', () => {
    const before = createProgress()

    recordOutcome(before, { kind: '홈런' }, 1)

    expect(before.plateAppearances).toBe(0)
  })
})

describe('투수편 목표 판정', () => {
  it('투수 미션 목록은 14개다', () => {
    expect(PITCHER_MISSIONS).toHaveLength(14)
  })

  it('원작 투수 미션 이름이 들어있다', () => {
    const names = PITCHER_MISSIONS.map((m) => m.name)

    expect(names).toContain('깔끔한 마무리')
    expect(names).toContain('연속 삼진 쇼')
    expect(names).toContain('완벽한 승리자')
  })

  it('삼진은 탈삼진과 아웃 둘 다에 잡힌다', () => {
    expect(pitcherGoalNamesFor({ kind: '삼진' }, '')).toEqual(['탈삼진', '아웃'])
  })

  it('PERFECT 게이지는 MAX게이지 목표에 잡힌다', () => {
    expect(pitcherGoalNamesFor({ kind: '아웃', detail: '땅볼아웃' }, 'PERFECT')).toContain(
      'MAX게이지',
    )
  })

  it('안타는 아무 목표에도 잡히지 않는다', () => {
    expect(pitcherGoalNamesFor({ kind: '안타', bases: 1 }, '')).toEqual([])
  })

  it('삼진 콤보는 연속일 때만 쌓인다', () => {
    let progress = createProgress()
    progress = recordPitcherOutcome(progress, { kind: '삼진' }, 0)
    progress = recordPitcherOutcome(progress, { kind: '삼진' }, 0)
    expect(progress.counts['삼진콤보']).toBe(2)

    progress = recordPitcherOutcome(progress, { kind: '안타', bases: 1 }, 0)

    expect(progress.counts['삼진콤보']).toBe(0)
  })

  it('안타를 맞으면 노히트노런이 0으로 돌아간다', () => {
    let progress = createProgress()
    progress = recordPitcherOutcome(progress, { kind: '아웃', detail: '땅볼아웃' }, 0)
    progress = recordPitcherOutcome(progress, { kind: '삼진' }, 0)
    expect(progress.counts['노히트노런']).toBe(2)

    progress = recordPitcherOutcome(progress, { kind: '안타', bases: 1 }, 0)

    expect(progress.counts['노히트노런']).toBe(0)
  })

  it('볼넷은 노히트노런은 지키지만 퍼펙트게임은 깬다', () => {
    let progress = createProgress()
    progress = recordPitcherOutcome(progress, { kind: '아웃', detail: '땅볼아웃' }, 0)
    progress = recordPitcherOutcome(progress, { kind: '볼넷' }, 0)

    // 노히트노런은 깨지지 않고 잡은 아웃(1)을 유지한다
    expect(progress.counts['노히트노런']).toBe(1)
    expect(progress.counts['퍼펙트게임']).toBe(0)
  })

  it('한도에 닿아 깨진 조건을 한 번씩만 남긴다', () => {
    let progress = createProgress()
    progress = recordPitcherOutcome(progress, { kind: '안타', bases: 1 }, 0, [])
    expect(progress.brokenConditions).toEqual([])

    progress = recordPitcherOutcome(progress, { kind: '홈런' }, 0, ['무실점'])
    progress = recordPitcherOutcome(progress, { kind: '홈런' }, 0, ['무실점'])

    expect(progress.brokenConditions).toEqual(['무실점'])
  })

  it('PERFECT 게이지 수만큼 MAX게이지가 쌓인다', () => {
    const progress = recordPitcherOutcome(createProgress(), { kind: '삼진' }, 3)

    expect(progress.counts['MAX게이지']).toBe(3)
  })
})

describe('isEveryMissionCleared — 미션 올 클리어', () => {
  it('선택 목록 28개를 모두 깨야 참이다', () => {
    const all = [...BATTER_MISSIONS, ...PITCHER_MISSIONS].map(missionKeyOf)
    expect(isEveryMissionCleared(all)).toBe(true)
    expect(isEveryMissionCleared(all.slice(1))).toBe(false)
  })
})
