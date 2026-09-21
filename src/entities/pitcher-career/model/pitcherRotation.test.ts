import { describe, expect, it } from 'vitest'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  BATTER_EDITION_MODE,
  COLD_GAME_INNING_INDEX,
  PITCHER_EDITION_MODE,
  RELIEF_ENTRY_INNING_INDEX,
  SEASON_MODE,
  START_ASSIGNMENT,
  advanceRotation,
  cpuGameRotationAdvances,
  isMyStartDay,
  preGameRotationPlanOf,
  reliefNeverEnteredOf,
  rotationSlotOf,
  shouldEnterAsRelief,
  startAssignmentOf,
  swapWithStarter,
} from '@/entities/pitcher-career/model/pitcherRotation'

describe('4인 로테이션 (0xb5ca8)', () => {
  it('투수 0~3 을 한 칸 당기고 0번을 3번 자리로 보낸다', () => {
    expect(advanceRotation(['M', 'A', 'B', 'C'])).toEqual(['A', 'B', 'C', 'M'])
  })

  it('5번 이후 투수는 건드리지 않는다', () => {
    expect(advanceRotation(['M', 'A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'M', 'D', 'E'])
  })

  it('네 바퀴를 돌면 제자리다', () => {
    let roster = ['M', 'A', 'B', 'C']
    for (let day = 0; day < 4; day += 1) roster = advanceRotation(roster)
    expect(roster).toEqual(['M', 'A', 'B', 'C'])
  })

  it('맞바꿈은 0번과 k번만 바꾼다', () => {
    expect(swapWithStarter(['M', 'A', 'B', 'C'], 2)).toEqual(['B', 'A', 'M', 'C'])
    expect(swapWithStarter(['M', 'A', 'B', 'C'], 0)).toEqual(['M', 'A', 'B', 'C'])
  })
})

describe('선발 등판 판정 0xa4f60', () => {
  const starter = {
    mode: PITCHER_EDITION_MODE,
    role: PITCHER_ROLE.starter,
    isPostseason: false,
  } as const

  it('표 그대로 k 를 돌려준다 (g 1,2 → 1 · 3,4 → 2 · 5,6 → 3 · 7,8 → 1)', () => {
    const k = (dayCounter: number) => startAssignmentOf({ ...starter, dayCounter })
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(k)).toEqual([1, 1, 2, 2, 3, 3, 1, 1])
  })

  it('시즌 첫 경기(g=0)와 포스트시즌은 아무것도 하지 않는다', () => {
    expect(startAssignmentOf({ ...starter, dayCounter: 0 })).toBe(START_ASSIGNMENT.keep)
    expect(startAssignmentOf({ ...starter, dayCounter: 4, isPostseason: true })).toBe(START_ASSIGNMENT.keep)
  })

  it('구원과 보직 1 은 보통 로테이션만 돈다', () => {
    expect(startAssignmentOf({ ...starter, dayCounter: 4, role: PITCHER_ROLE.relief })).toBe(
      START_ASSIGNMENT.rotate,
    )
    expect(startAssignmentOf({ ...starter, dayCounter: 4, role: PITCHER_ROLE.unknown })).toBe(
      START_ASSIGNMENT.rotate,
    )
  })

  it('투수편이 아니면 판정 자체가 없다', () => {
    expect(startAssignmentOf({ ...starter, mode: BATTER_EDITION_MODE, dayCounter: 4 })).toBe(
      START_ASSIGNMENT.rotate,
    )
  })
})

describe('내 선발은 짝수 날마다 마운드에 선다 (StrHOWTO[11] "2경기마다")', () => {
  it('맞바꿈을 날마다 실제로 돌려 보면 0·2·4·6 일에 내 투수가 0번이다', () => {
    let roster = ['M', 'A', 'B', 'C']
    const startersByDay: string[] = [roster[0]]
    for (let dayCounter = 1; dayCounter <= 8; dayCounter += 1) {
      const plan = preGameRotationPlanOf({
        mode: PITCHER_EDITION_MODE,
        dayCounter,
        role: PITCHER_ROLE.starter,
        isPostseason: false,
      })
      if (plan.advanceMine) roster = advanceRotation(roster)
      if (plan.swapSlot > 0) roster = swapWithStarter(roster, plan.swapSlot)
      startersByDay.push(roster[0])
    }
    expect(startersByDay).toEqual(['M', 'A', 'M', 'B', 'M', 'C', 'M', 'A', 'M'])
    expect(startersByDay.map((_name, day) => isMyStartDay(day))).toEqual(
      startersByDay.map((name) => name === 'M'),
    )
  })

  it('상대 팀은 첫 경기만 빼고 날마다 한 칸 돈다', () => {
    const base = { mode: PITCHER_EDITION_MODE, role: PITCHER_ROLE.starter, isPostseason: false }
    expect(preGameRotationPlanOf({ ...base, dayCounter: 0 }).advanceOpponent).toBe(false)
    expect(preGameRotationPlanOf({ ...base, dayCounter: 1 }).advanceOpponent).toBe(true)
  })

  it('시즌 첫 경기에는 내 투수를 0번으로 끌어온다 — 구원이면 하지 않는다', () => {
    const base = { mode: PITCHER_EDITION_MODE, dayCounter: 0, isPostseason: false }
    expect(preGameRotationPlanOf({ ...base, role: PITCHER_ROLE.starter }).moveMineToStartSlot).toBe(true)
    expect(preGameRotationPlanOf({ ...base, role: PITCHER_ROLE.relief }).moveMineToStartSlot).toBe(false)
  })

  it('타자편은 내 팀도 그냥 한 칸 돈다', () => {
    const plan = preGameRotationPlanOf({
      mode: BATTER_EDITION_MODE,
      dayCounter: 3,
      role: PITCHER_ROLE.starter,
      isPostseason: false,
    })
    expect(plan).toMatchObject({ advanceMine: true, swapSlot: 0, moveMineToStartSlot: false })
  })
})

describe('CPU 끼리의 경기도 4인 로테이션을 돈다 (S5 U-16 — P1 1-4 정정)', () => {
  it('시즌·투수편·타자편에서 날짜 카운터가 0 이 아니면 돈다', () => {
    expect(cpuGameRotationAdvances(SEASON_MODE, 3)).toBe(true)
    expect(cpuGameRotationAdvances(PITCHER_EDITION_MODE, 3)).toBe(true)
    expect(cpuGameRotationAdvances(BATTER_EDITION_MODE, 3)).toBe(true)
  })

  it('첫날과 그 밖의 모드에서는 돌지 않는다', () => {
    expect(cpuGameRotationAdvances(SEASON_MODE, 0)).toBe(false)
    expect(cpuGameRotationAdvances(1, 3)).toBe(false)
  })
})

describe('구원 8회 등판 (0xc1ba4)', () => {
  const base = {
    mode: PITCHER_EDITION_MODE,
    role: PITCHER_ROLE.relief,
    defenseIsHuman: true,
    myPitcherOnMound: false,
    benchSlotOfMine: 5,
    inningIndex: RELIEF_ENTRY_INNING_INDEX,
  } as const

  it('8회(0-기준 7)에만 올라온다', () => {
    expect(shouldEnterAsRelief(base)).toBe(true)
    expect(shouldEnterAsRelief({ ...base, inningIndex: 6 })).toBe(false)
    expect(shouldEnterAsRelief({ ...base, inningIndex: 8 })).toBe(false)
  })

  it('상대 팀 수비(벤치에 내 선수가 없음)·이미 마운드에 섬·선발 보직이면 올라오지 않는다', () => {
    expect(shouldEnterAsRelief({ ...base, benchSlotOfMine: -1 })).toBe(false)
    expect(shouldEnterAsRelief({ ...base, defenseIsHuman: false })).toBe(false)
    expect(shouldEnterAsRelief({ ...base, myPitcherOnMound: true })).toBe(false)
    expect(shouldEnterAsRelief({ ...base, role: PITCHER_ROLE.starter })).toBe(false)
  })
})

describe('7회 콜드게임 = 등판 기회 없음 (S5 U-14)', () => {
  it('끝난 이닝 인덱스가 6 일 때만 선다', () => {
    expect(reliefNeverEnteredOf(COLD_GAME_INNING_INDEX)).toBe(true)
    expect(reliefNeverEnteredOf(7)).toBe(false)
    expect(reliefNeverEnteredOf(8)).toBe(false)
  })
})

describe('붙박이 로스터용 선발 칸 셈 `rotationSlotOf` (근사)', () => {
  it('네 경기를 연달아 치르면 선발이 0 → 1 → 2 → 3 으로 돌고 다시 0 으로 온다', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(rotationSlotOf)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0])
  })

  it('로스터를 g 번 실제로 돌린 뒤의 0번과 같은 칸을 가리킨다 (0xb5ca8 과 맞춰 본다)', () => {
    let roster = [0, 1, 2, 3, 4, 5, 6, 7]
    for (let g = 0; g < 12; g += 1) {
      expect(roster[0], `${g}일차`).toBe(rotationSlotOf(g))
      roster = advanceRotation(roster)
    }
  })

  it('음수 날짜가 들어와도 0~3 안에 머문다 (원본에는 없는 경우라 안전망이다)', () => {
    expect([-1, -4, -5].map(rotationSlotOf)).toEqual([3, 0, 3])
  })
})
