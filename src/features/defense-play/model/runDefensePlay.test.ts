import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { AUTO_ADVANCE_TICK_MARGIN, beatsThrow } from '@/entities/fielding/model/autoAdvance'
import { BASE_POSITIONS, FIELDER_COUNT } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type {
  DefensePlayControls,
  DefensePlayInput,
  DefensePlayResult,
} from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
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

  // 주루 700 으로 올린 까닭: 포구 반경(내야 500 · 외야 300)이 되살아나면서 야수가 한두 틱 먼저 잡게 됐고,
  // 그래서 **평범한 주자(500)는 땅볼에서 홈 송구에 잡힌다**. 보류 규칙이 무엇을 막는지 보이려면
  // 0아웃이었을 때 실제로 점수가 나는 주자가 있어야 해서 발이 빠른 주자로 바꿨다.
  it('2아웃 땅볼로 타자주자가 죽으면 그 플레이 득점은 0 이다 (S2 2-5)', () => {
    const 없을때 = play(땅볼아웃, 주자3루, 0, representativePatternOf(땅볼아웃), 700)
    const 두아웃 = play(땅볼아웃, 주자3루, 2, representativePatternOf(땅볼아웃), 700)

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

/** next() 가 늘 같은 값인 난수 포트 — 0 이면 모든 확률 굴림이 성공하고, 1 에 가까우면 전부 실패한다 */
const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: (candidates) => candidates[0],
})

/** next() 를 차례대로 돌려주는 난수 포트 — 굴림 하나만 떼어 볼 때 쓴다 */
const 차례난수 = (values: readonly number[]): RandomPort => {
  let index = 0
  return {
    next: () => values[Math.min(index++, values.length - 1)],
    nextInRange: (minimum, maximum) => (minimum + maximum) / 2,
    pick: (candidates) => candidates[0],
  }
}

/** 틱마다 같은 키를 눌러 주는 조작 — 화면이 넘겨야 하는 모양 그대로다 */
const 계속누름 = (side: '공격' | '수비', key: string): DefensePlayControls => ({
  side,
  keyAt: () => ({ key, isRepeat: false }),
})

describe('확률 굴림은 난수를 줘야 돈다 — 펌블 · 악송구 · 필살수비 (I-controls 2a·2b·2c)', () => {
  const 굴림포함 = (random: RandomPort, extra: Partial<DefensePlayInput> = {}) =>
    runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(representativePatternOf(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random,
      ...extra,
    })

  it('난수를 안 주면 아무것도 굴리지 않는다 — 지금까지의 결정론 그대로다', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(false)
    expect(결과.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
    expect(결과.laserThrow).toBe(false)
  })

  it('난수가 늘 0 이면 펌블이 난다 — 동작 잠금 15틱만큼 포구가 늦어진다 (야수+0xb4 = 15)', () => {
    const 결과 = 굴림포함(고정난수(0))

    expect(결과.fumbled).toBe(true)
    expect(결과.log.some((line) => line.includes('펌블'))).toBe(true)
    expect(결과.catchTick).toBe(play(땅볼아웃, EMPTY_BASES, 0).catchTick + 15)
  })

  it('악송구가 나면 그 송구로는 아무도 못 잡는다 (0xa1828 — 방향이 틀어진다)', () => {
    // 굴림 순서대로 값을 먹인다: 필살수비 A → B → 펌블 → 악송구.
    // 앞 셋은 실패(0.9), 마지막만 성공(0) 시켜 **악송구만** 떼어 본다.
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(representativePatternOf(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0.9, 0.9, 0.9, 0, 0.9]),
    })

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(true)
    expect(결과.log.some((line) => line.includes('악송구'))).toBe(true)
    // 1루 주자는 홈 송구가 빗나가 살아 있다 — 잡힌 아웃은 타자주자 하나뿐이다
    expect(결과.advance.outsAdded).toBe(1)
  })

  it('난수가 늘 1 에 가까우면 하나도 안 걸린다', () => {
    const 결과 = 굴림포함(고정난수(0.999))

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(false)
    expect(결과.specialDefense.jumpUnlocked).toBe(false)
  })

  it('필살수비는 A(점프) 먼저, 실패했을 때만 B(슬라이딩) — 그리고 모드 7 은 아예 안 굴린다', () => {
    const 걸림 = 굴림포함(고정난수(0), { trajectory: battedBallTrajectory(깊은뜬공), outcome: 뜬공아웃 })
    expect(걸림.specialDefense).toEqual({ jumpUnlocked: true, slideUnlocked: false })

    const 홈런더비 = 굴림포함(고정난수(0), {
      trajectory: battedBallTrajectory(깊은뜬공),
      outcome: 뜬공아웃,
      gameMode: 7,
    })
    expect(홈런더비.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: false })
  })
})

describe('사람 조작 — 상태 0x17 키 표 (I-controls 0·2b·2d·3b)', () => {
  it("수비일 때 '2' 는 2루 송구다 — 사람이 고른 목표가 CPU 점수식보다 앞선다", () => {
    const 자동 = play(단타, 주자1루, 0)
    const 수동 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('수비', '2'),
    })

    expect(수동.throwBase).toBe(2)
    expect(수동.log.some((line) => line.includes('사람이 2루로 송구 지시'))).toBe(true)
    // 자동은 같은 루를 고를 수도 있으니 "지시가 기록됐다" 로 가른다
    expect(자동.log.some((line) => line.includes('사람이'))).toBe(false)
  })

  it("공격일 때 '8' 은 3루 주자 진루다 — 얕은 뜬공에서 못 들어오던 주자를 뛰게 한다", () => {
    const 가만히 = play(뜬공아웃, 주자3루, 0, 얕은뜬공)
    const 태그업 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(얕은뜬공),
      bases: 주자3루,
      outs: 0,
      controls: 계속누름('공격', '8'),
    })

    expect(가만히.advance.runsScored).toBe(0)
    expect(태그업.log.some((line) => line.includes('진루'))).toBe(true)
  })

  it('OK 는 슬라이딩이다 — 진행률 71~94% 구간에 든 주자만 걸린다 (0xa9690)', () => {
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('공격', ' '),
    })

    expect(결과.log.some((line) => line.includes('슬라이딩'))).toBe(true)
  })

  it('레이저 송구는 반짝임 창 안에 새로 누른 키가 있어야 나간다 (0x66a8c · 0xb2648 · 0x4e858)', () => {
    const 공통 = {
      outcome: 단타,
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
      bases: 주자1루,
      outs: 0,
      random: 고정난수(0),
    }
    const 눌렀다 = runDefensePlay({ ...공통, controls: 계속누름('수비', '2') })
    const 누르고있다 = runDefensePlay({
      ...공통,
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: true }) },
    })
    const 안눌렀다 = runDefensePlay({ ...공통, controls: { side: '수비', keyAt: () => null } })

    expect(눌렀다.laserThrow).toBe(true)
    // 누르고 있기로는 안 된다 — 원본이 키 반복 계수 0 만 받는다
    expect(누르고있다.laserThrow).toBe(false)
    expect(안눌렀다.laserThrow).toBe(false)
  })
})

describe('필살타법 성공 타구는 야수가 잡지 못한다 — 공 비트 4 (0x51800 · 0xaf180 · 0xbc3, S13 6절)', () => {
  const 필살타구 = (outcome: AtBatOutcome, bases: BaseState, outs: number, pattern?: BattedBallPattern) =>
    runDefensePlay({
      outcome,
      trajectory: battedBallTrajectory(pattern ?? representativePatternOf(outcome)),
      bases,
      outs,
      isUncatchable: true,
    })

  it('뜬공아웃이어도 잡히지 않아 아웃이 하나도 안 난다', () => {
    const 보통 = play(뜬공아웃, EMPTY_BASES, 0, 깊은뜬공)
    const 필살 = 필살타구(뜬공아웃, EMPTY_BASES, 0, 깊은뜬공)

    expect(보통.advance.outsAdded).toBe(1)
    expect(필살.advance.outsAdded).toBe(0)
    expect(필살.isUncatchable).toBe(true)
    expect(필살.caughtOnTheFly).toBe(false)
  })

  it('포구를 건너뛰므로 송구도 없다 — 진행 기록에 "잡았다" 가 없다', () => {
    const 필살 = 필살타구(땅볼아웃, EMPTY_BASES, 0)

    expect(필살.log.some((line) => line.includes('잡았다'))).toBe(false)
    expect(필살.throwBase).toBe(-1)
    expect(필살.throwArrivalTick).toBe(-1)
  })

  it('3루 주자는 잡히지 않은 타구에 그대로 홈을 밟는다', () => {
    const 필살 = 필살타구(뜬공아웃, 주자3루, 2, 깊은뜬공)

    expect(필살.advance.runsScored).toBe(1)
    expect(필살.advance.outsAdded).toBe(0)
  })

  it('공은 끝까지 궤적 위에 있다 — 야수 손으로 옮겨 가지 않는다', () => {
    const 필살 = 필살타구(땅볼아웃, EMPTY_BASES, 0)
    const 궤적 = battedBallTrajectory(representativePatternOf(땅볼아웃))
    const 마지막 = 필살.ticks[필살.ticks.length - 1]

    expect(마지막.ball.x).toBe(궤적.pointAt(필살.ticks.length - 1).x)
  })
})
