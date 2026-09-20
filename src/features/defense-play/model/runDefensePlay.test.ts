import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { AUTO_ADVANCE_TICK_MARGIN, beatsThrow } from '@/entities/fielding/model/autoAdvance'
import { BASE_POSITIONS, FIELDER_COUNT } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 뜬공아웃: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
const 직선타아웃: AtBatOutcome = { kind: '아웃', detail: '직선타아웃' }
const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
const 이루타: AtBatOutcome = { kind: '안타', bases: 2 }
const 삼루타: AtBatOutcome = { kind: '안타', bases: 3 }

const 주자1루: BaseState = { first: true, second: false, third: false }
const 주자3루: BaseState = { first: false, second: false, third: true }
const 만루: BaseState = { first: true, second: true, third: true }

/** 외야 깊숙한 뜬공 — 송구가 늦어 태그업이 걸린다 */
const 깊은뜬공: BattedBallPattern = [90, 900, 1500, 0]
/** 내야 뒤에 겨우 뜬 공 — 송구가 빨라 태그업이 안 걸린다 */
const 얕은뜬공: BattedBallPattern = [90, 250, 700, 0]

function play(
  outcome: AtBatOutcome,
  bases: BaseState,
  outs: number,
  pattern: BattedBallPattern = representativePatternOf(outcome),
  runAbility = 500,
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases,
    outs,
    runAbility,
  })
}

describe('한 플레이 진행기 — 타자주자의 운명은 결과 코드, 나머지는 원본 수비 규칙', () => {
  it('삼진·볼넷·홈런은 수비를 돌릴 것이 없다', () => {
    expect(isBattedBallInPlay({ kind: '삼진' })).toBe(false)
    expect(isBattedBallInPlay({ kind: '볼넷' })).toBe(false)
    expect(isBattedBallInPlay({ kind: '홈런' })).toBe(false)
    expect(isBattedBallInPlay(땅볼아웃)).toBe(true)
    expect(isBattedBallInPlay(단타)).toBe(true)
  })

  it('주자 없는 땅볼은 아웃 하나로 끝난다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(EMPTY_BASES)
    expect(결과.caughtOnTheFly).toBe(false)
  })

  it('1루 주자가 있는 땅볼은 주자를 2루로 보내고 타자를 죽인다', () => {
    const 결과 = play(땅볼아웃, 주자1루, 0)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.bases).toEqual({ first: false, second: true, third: false })
  })

  it('뜬공·직선타는 뜬 채로 잡히고 땅볼은 굴러간 공을 줍는다', () => {
    expect(play(뜬공아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(직선타아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(땅볼아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(false)
  })

  it('직선타를 잡히면 주자는 원래 루에 그대로 있다 (0xa9620 리터치)', () => {
    const 결과 = play(직선타아웃, 만루, 0)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(만루)
  })

  it('안타는 결과 코드가 정한 루까지 타자주자를 보낸다', () => {
    expect(play(단타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: true, second: false, third: false },
    })
    expect(play(이루타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: false, second: true, third: false },
    })
    expect(play(삼루타, EMPTY_BASES, 0).advance).toMatchObject({
      outsAdded: 0,
      bases: { first: false, second: false, third: true },
    })
  })

  it('3루 주자는 안타에 홈을 밟는다', () => {
    const 결과 = play(단타, 주자3루, 0)

    expect(결과.advance.runsScored).toBe(1)
    expect(결과.advance.bases.third).toBe(false)
  })
})

describe('희생플라이는 "보장" 이 아니라 자동 진루 규칙(0xaf918)의 결과다', () => {
  it('외야 깊은 뜬공이면 3루 주자가 태그업해 들어온다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 깊은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.advance.bases).toEqual(EMPTY_BASES)
  })

  it('내야 뒤 얕은 뜬공이면 3루 주자가 못 들어온다 — 원본에 희생플라이 보장이 없다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 얕은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(주자3루)
  })

  it('판정은 "수비 송구보다 2틱 넘게 빠를 때" 다 — 딱 1틱으로는 안 뛴다', () => {
    expect(AUTO_ADVANCE_TICK_MARGIN).toBe(2)
    expect(beatsThrow(20, 21)).toBe(false)
    expect(beatsThrow(20, 22)).toBe(true)
  })

  it('태그업은 포구 뒤에 시작한다 — 잡힐 뜬공이면 그 전에는 아무도 안 뛴다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 0, 깊은뜬공)
    const 포구순간 = 결과.ticks[결과.catchTick].runners.find((runner) => runner.index === 1)

    // 포구 순간까지 3루에 붙어 있다가, 잡히고 나서야 홈으로 뛴다
    expect(포구순간).toMatchObject({ x: BASE_POSITIONS[3].x, z: BASE_POSITIONS[3].z })
    expect(결과.ticks.length).toBeGreaterThan(결과.catchTick + 20)
  })
})

describe('2아웃 득점 보류 — state[0] (0xaa164 · 0xaa34c · 0xaa388)', () => {
  it('2아웃 뜬공이면 3루 주자가 들어와도 점수가 안 된다', () => {
    const 결과 = play(뜬공아웃, 주자3루, 2, 깊은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.voidedRuns).toBeGreaterThanOrEqual(1)
  })

  it('2아웃 땅볼로 타자주자가 죽으면 그 플레이 득점은 0 이다 (S2 2-5)', () => {
    const 없을때 = play(땅볼아웃, 주자3루, 0)
    const 두아웃 = play(땅볼아웃, 주자3루, 2)

    expect(두아웃.advance.outsAdded).toBeGreaterThanOrEqual(1)
    expect(두아웃.advance.runsScored).toBe(0)
    // 0아웃이었다면 같은 타구에 점수가 났다 — 보류 규칙이 걸렸다는 뜻
    expect(없을때.advance.runsScored).toBe(1)
  })

  it('2아웃이라도 안타로 타자주자가 살면 점수는 그대로 난다', () => {
    const 결과 = play(단타, 주자3루, 2)

    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.runsScored).toBe(1)
  })
})

describe('화면 스냅샷 — 진행기가 DefenseViewState 를 틱마다 내준다', () => {
  it('틱마다 야수 9명과 주자들이 들어 있다', () => {
    const 결과 = play(단타, 주자1루, 0)

    expect(결과.ticks.length).toBeGreaterThan(1)
    결과.ticks.forEach((view, index) => {
      expect(view.tick).toBe(index)
      expect(view.fielders).toHaveLength(FIELDER_COUNT)
      expect(view.runners).toHaveLength(2)
      expect(view.fielders.map((fielder) => fielder.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    })
  })

  it('첫 틱의 공은 타구 시작점이고, 잡히기 전에는 날아가는 중이다', () => {
    const 궤적 = battedBallTrajectory(깊은뜬공)
    const 결과 = runDefensePlay({ outcome: 뜬공아웃, trajectory: 궤적, bases: EMPTY_BASES, outs: 0 })
    const 첫틱 = 결과.ticks[0]

    expect(첫틱.ball.x).toBe(궤적.pointAt(0).x)
    expect(첫틱.ball.z).toBe(궤적.pointAt(0).z)
    expect(첫틱.ball.height).toBe(궤적.pointAt(0).y)
    expect(첫틱.ball.isFlying).toBe(true)
    // 송구까지 끝나면 공은 더 날지 않는다
    expect(결과.ticks[결과.ticks.length - 1].ball.isFlying).toBe(false)
  })

  it('같은 동작이 이어지면 actionTick 이 올라간다', () => {
    const 결과 = play(뜬공아웃, EMPTY_BASES, 0, 깊은뜬공)
    const 쫓는야수 = 결과.catchFielderSlot
    const 동작들 = 결과.ticks.map((view) => view.fielders[쫓는야수])

    // 처음 잡힐 때까지 계속 달리므로 동작 번호가 유지되고 틱이 늘어난다
    const 달리는구간 = 동작들.slice(1, 5)
    expect(new Set(달리는구간.map((fielder) => fielder.action)).size).toBe(1)
    expect(달리는구간.map((fielder) => fielder.actionTick)).toEqual([1, 2, 3, 4])
  })
})

describe('대표 패턴 고르기 — 원본 표 안에서만 고른다', () => {
  it('고른 패턴은 원본 표에 그대로 들어 있는 항목이다', () => {
    const 모든패턴 = Object.values(BATTED_BALL_PATTERNS).flat()
    for (const outcome of [땅볼아웃, 뜬공아웃, 직선타아웃, 단타, 이루타, 삼루타]) {
      const pattern = representativePatternOf(outcome)
      expect(모든패턴).toContain(pattern)
      // 페어 범위(45~135) 안이어야 타구가 된다
      expect(pattern[0]).toBeGreaterThanOrEqual(45)
      expect(pattern[0]).toBeLessThanOrEqual(135)
    }
  })

  it('같은 결과에는 늘 같은 패턴이 나온다', () => {
    expect(representativePatternOf(이루타)).toEqual(representativePatternOf(이루타))
  })
})
