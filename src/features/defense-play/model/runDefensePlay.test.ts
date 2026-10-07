import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { AUTO_ADVANCE_TICK_MARGIN, beatsThrow } from '@/entities/fielding/model/autoAdvance'
import {
  BASE_POSITIONS,
  FIELDER_COUNT,
  FIELDER_START_POSITIONS,
  basePosition,
} from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { AI_STATE, createFielders } from '@/entities/fielding/model/fieldingState'
import { throwTicksToFielder } from '@/entities/fielding/model/throwPlan'
import {
  cpuSpecialThrowOf,
  defenseAbilitiesOf,
  isBattedBallInPlay,
  isDefensePlayFinished,
  runDefensePlay,
  startDefensePlay,
  stepDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
import type {
  DefensePlayControls,
  DefensePlayInput,
  DefensePlayResult,
} from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
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

/** 외야 깊숙한 뜬공 — 송구가 늦어 태그업이 걸린다. 원본 코드 0 [92, 895, 1017] (중견수가 낙구 24 전 23틱에 잡는다) */
const 깊은뜬공: BattedBallPattern = [92, 895, 1017, 0]
/** 내야 뒤에 겨우 뜬 공 — 송구가 빨라 태그업이 안 걸린다 */
const 얕은뜬공: BattedBallPattern = [90, 250, 700, 0]

/**
 * 타구 하나를 **CPU 수비**(사람 타석의 수비 — CPU 송구 결정 0xafa60 이 돈다)로 돌린다.
 * 결과(`outcome`)는 패턴을 안 줄 때 그 결과를 내는 원본 패턴을 고르는 데만 쓴다(`fixturePatternFor`) —
 * 진행기는 결과를 보지 않고, 안타·아웃은 판 끝 정산이 낸다(`DefensePlayResult.outcome`).
 */
function play(
  outcome: AtBatOutcome,
  bases: BaseState,
  outs: number,
  pattern: BattedBallPattern = fixturePatternFor(outcome),
  runAbility = 500,
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases,
    outs,
    runAbility,
    defenseIsCpu: true,
  })
}

/**
 * 주루 수동/자동까지 골라 돌린다.
 *
 * 송구는 **자동으로 못 박는다** — 이 갈래를 쓰는 시험들은 포스 사슬을 보는 것이고,
 * 송구 설정(+0xf4)의 원본 기본값은 수동이라 안 박아 두면 목표 루 고르는 함수가
 * 점수식 0xafb24 에서 0xb1c90 으로 바뀌어 아웃·득점이 따라 흔들린다.
 * 송구 갈림 자체는 아래 "송구 수동/자동" 묶음이 따로 본다.
 */
function play2(
  outcome: AtBatOutcome,
  bases: BaseState,
  outs: number,
  runningMode: '수동' | '자동',
  throwMode: '수동' | '자동' = '자동',
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(fixturePatternFor(outcome)),
    bases,
    outs,
    runAbility: 500,
    runningMode,
    throwMode,
  })
}

describe('한 플레이 진행기 — 타자주자도 원본 수비 규칙으로 움직이고, 결과는 판 끝 정산(0xa8024)이 낸다', () => {
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

  it('1루 주자가 있는 땅볼 — CPU 송구 결정이 2루 포스를 고르면 1루 주자가 죽고 타자주자는 1루에 산다 (야수 선택)', () => {
    const 결과 = play(땅볼아웃, 주자1루, 0)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.bases).toEqual({ first: true, second: false, third: false })
    expect(결과.log).toContain('15틱 1번 주자 루 아웃 (0xb36d0 결과 2)')
    // 정산 0xa8024 의 야수 선택 [sp+0x18] — 목록 1번 주자가 +0x7c == 2 로 죽었다 → 안타가 아니다(타수만 든다)
    expect(결과.outcome).toEqual({ kind: '아웃', detail: '땅볼아웃' })
  })

  it('뜬공·직선타는 뜬 채로 잡히고 땅볼은 굴러간 공을 줍는다', () => {
    expect(play(뜬공아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(직선타아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(true)
    expect(play(땅볼아웃, EMPTY_BASES, 0).caughtOnTheFly).toBe(false)
  })

  /**
   * 원본 `state[0x87]` — 아웃 콜 62/20 을 가르는 칸(0x51b44). "한 번이라도" 가 아니라
   * **마지막 아웃 판정이 태그였나** 다 (0xb36d0 이 부를 때마다 0 으로 지우고 시작한다).
   */
  it('tagOut = 마지막 아웃 판정이 태그였나 (state[0x87])', () => {
    // 아웃 판정이 한 번도 태그를 내지 않는 평범한 땅볼·뜬공은 서지 않는다
    expect(play(땅볼아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(뜬공아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(단타, 만루, 0).tagOut).toBe(false)
    // 1루 주자 땅볼에 사람이 '2'(2루 송구)를 누른다 — 키가 없으면 사람 수동 송구는 아무도 안 던진다
    const 이루송구 = (pattern: BattedBallPattern) =>
      runDefensePlay({
        outcome: 땅볼아웃,
        trajectory: battedBallTrajectory(pattern),
        bases: 주자1루,
        outs: 0,
        runAbility: 500,
        controls: 계속누름('수비', '2'),
      })
    // 공 쥔 야수가 2루를 밟고 있어 **포스(루) 아웃**(0xb3890 2a)이면 서지 않는다
    // (2a 의 vt10 = 0xa9f60 은 `산 주자 수 > [주자+0x8c]`, 곧 **마지막으로 닿은 루**를 본다)
    const 포스땅볼 = 이루송구([81, 897, 290, 1]) // 원본 코드 3
    expect(포스땅볼.tagOut).toBe(false)
    expect(포스땅볼.log.some((줄) => 줄.includes('루 아웃'))).toBe(true)
    // 1루 선상의 땅볼을 1루수(2)가 잡는 그 틱에, 1루로 뛰던 타자주자와 닿으면 태그(3a)다 — 타자주자도 판정을 받는다.
    // (예전 손-패턴 [73, 1200, 100] 은 결과를 먼저 정하던 다리 없이 돌리면 투수가 뜬 채로 잡는 공이다)
    const 태그땅볼 = 이루송구([47, 500, 301, 1]) // 원본 코드 5
    expect(태그땅볼.tagOut).toBe(true)
    expect(태그땅볼.log.some((줄) => 줄.includes('태그 아웃'))).toBe(true)
  })

  it('얕게 뜬 공을 잡히면 주자는 원래 루에 그대로 있다 (0xa9620 리터치)', () => {
    const 결과 = play(직선타아웃, 만루, 0, 얕은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.advance.bases).toEqual(만루)
  })

  it('안타 — 타자주자가 판 끝에 선 루가 곧 루타다 (정산 0xa8024 가 +0x8c 를 읽는다)', () => {
    expect(play(단타, EMPTY_BASES, 0).outcome).toEqual(단타)
    expect(play(이루타, EMPTY_BASES, 0).outcome).toEqual(이루타)
    expect(play(삼루타, EMPTY_BASES, 0).outcome).toEqual(삼루타)
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
    // 첫 포구 틱 — `catchTick` 은 뒤에 송구를 받은 틱으로 바뀐다
    const 첫포구 = Number.parseInt(결과.log.find((줄) => 줄.includes('잡았다'))!, 10)
    expect(첫포구).toBe(23)
    const 포구순간 = 결과.ticks[첫포구].runners.find((runner) => runner.index === 1)

    // 포구 순간까지 3루에 붙어 있다가, 잡히고 나서야 홈으로 뛴다
    expect(포구순간).toMatchObject({ x: BASE_POSITIONS[3].x, z: BASE_POSITIONS[3].z })
    expect(결과.ticks.length).toBeGreaterThan(첫포구 + 20)
  })
})

describe('2아웃 득점 보류 — state[0] (0xaa164 · 0xaa34c · 0xaa388)', () => {
  it('2아웃 뜬공 — 친 순간 뛴(0xa9e44) 3루 주자가 포구 전에 홈을 밟으면 공이 땅에 안 닿아 바로 득점(0xaa16e), 포구가 3아웃', () => {
    // ⚠️ 원본 그대로: 보류는 state[0x1e](공이 땅에 닿은 플레이)일 때만이라 뜬 공이 잡히기 전 득점은 남는다
    const 결과 = play(뜬공아웃, 주자3루, 2, 깊은뜬공)

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.voidedRuns).toBe(0)
    expect(결과.log[0]).toContain('홈 — 보류 0 / 득점 1')
  })

  it('2아웃 땅볼 — 타자주자가 죽은 틱에 홈을 밟은 주자는 보류(0xaa1c0)되고 3아웃이라 영영 안 풀린다(0xaa388)', () => {
    // 원본 코드 3 — 투수가 잡아 CPU 송구로 1루에 던지고, 16틱에 타자주자가 1루 포스(0xb36d0 결과 2)로 죽는 그 틱에
    // 3루 주자가 홈을 밟는다. (예전 손-패턴 [70, 1000, 202] 의 판은 "결과 코드가 정한 1루 도착 틱" 다리에 기대고 있었다)
    const 결과 = play(땅볼아웃, 주자3루, 2, [99, 898, 290, 1])

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.advance.runsScored).toBe(0)
    expect(결과.voidedRuns).toBe(1)
    expect(결과.log).toContain('16틱 1번 주자 홈 — 보류 1 / 득점 0')
  })

  it('2아웃 땅볼 — 타자주자가 살아 뛰던 때 바로 올린 득점(0xaa1b0)은 뒤에 타자주자가 죽어 3아웃이 돼도 남는다', () => {
    // ⚠️ 원본 그대로: 바로 득점은 0xa5c34 가 점수판에 곧장 +1 하고, 팀+0x27c 칸을 되돌리는 코드는 없다.
    // 예전 웹은 S2 2-5 의 타석 단위 근사(3아웃 · 땅볼 · 타자주자 아웃 → 0)를 걸어 이 득점을 지웠다
    const 결과 = play(땅볼아웃, 주자3루, 2, [266, 94, 785, 0])

    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.runnerFates[0].retired).toBe(true)
    expect(결과.advance.runsScored).toBe(1)
    expect(결과.voidedRuns).toBe(0)
    expect(결과.log).toContain('16틱 1번 주자 홈 — 보류 0 / 득점 1')
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
      const pattern = fixturePatternFor(outcome)
      expect(모든패턴).toContain(pattern)
      // 페어 범위(45~135) 안이어야 타구가 된다
      expect(pattern[0]).toBeGreaterThanOrEqual(45)
      expect(pattern[0]).toBeLessThanOrEqual(135)
    }
  })

  it('같은 결과에는 늘 같은 패턴이 나온다', () => {
    expect(fixturePatternFor(이루타)).toEqual(fixturePatternFor(이루타))
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
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
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

  it('펌블이 나면 쥐지 않고, 틱 끝 0xb3148 이 공을 그 야수 자리에서 다시 쏘아 새 예보로 줍는다 (b4280 · b45a4)', () => {
    // 굴림 차례: 레이저 실패(0.9) → 펌블 성공(0) → 0xb3148 의 rand(−20, 20)(0.9 → +16)
    const 결과 = 굴림포함(차례난수([0.9, 0, 0.9]))
    const 보통 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.fumbled).toBe(true)
    // 보통 판에서 투수가 처음 쥐는 틱(6) — 그 틱에 펌블한다
    expect(보통.log).toContain('6틱 0번 야수가 잡았다 (종류 1)')
    expect(결과.log).toContain('6틱 0번 야수 펌블 (0xbc2)')
    // 다시 쏜 공: 속도 max(지금 점 속도·60%, 300) · v0 min(30%, 100) · 각 + 16
    const 튕김 = 결과.log.find((line) => line.includes('공 튕김'))
    // 펌블은 동작 잠금(+0xb4)이 없다 — 투수가 다시 줍되, 예보 n 이 추적야수가 건너뛴 4틱(b13ec)을 안 세어 t = 5 에 n = 1 부터다
    expect(튕김).toMatch(/^6틱 공 튕김 \(0xb3148\) — 속도 403 · v0 100 · 각 -65 · 0번 야수가 20틱에 줍는다$/)
    expect(결과.catchTick).toBe(20)
    expect(결과.log).toContain('20틱 0번 야수가 잡았다 (종류 0)')
  })

  it('늘 0 인 난수면 줍는 족족 펌블한다 — 원본도 포구 틱마다 굴린다(0xb41d0)', () => {
    const 결과 = 굴림포함(고정난수(0))

    expect(결과.fumbled).toBe(true)
    expect(결과.log.filter((line) => line.includes('펌블')).length).toBeGreaterThan(1)
    expect(결과.log.some((line) => line.includes('잡았다'))).toBe(false)
  })

  it('악송구가 나면 받을 야수가 아니라 예보 vt24(0)가 고른 야수가 줍는다 (0xa1828 · 0xb2e38 b2f8c 세계 · b307c)', () => {
    // 굴림 순서대로 값을 먹인다: (필살수비 A → B) → **레이저** → 펌블 → 악송구.
    // 대표 땅볼(원본 궤적)은 투수(0)가 줍는다 — 쫓는 야수가 투수·포수면 필살수비를 안 굴린다(0x50faa).
    // 그래서 레이저 · 펌블은 실패(0.9), 악송구만 성공(0) 시켜 **악송구만** 떼어 본다.
    //
    // ⚠️ 레이저 굴림(0x66a8c)이 셋째 자리에 있는 것은 **원본 그대로**다 — 0x523bc 는 사람·CPU 를
    // 가리지 않고 돌고(수비 주체 갈림은 0x52468 의 굴림 **뒤**), 창이 열리는 첫 틱(포구 10틱 전)이
    // 펌블 굴림(포구 틱, 0xb41d0)보다 앞선다. 예전에는 사람 수비일 때만 굴려 이 자리가 비어 있었다.
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      // 키 없는 사람 수동 송구는 안 던지므로 사람이 '8'(홈 송구)을 누른 판으로 본다 — 사람 송구는 특수 굴림이 없다
      controls: 계속누름('수비', '8'),
      random: 차례난수([0.9, 0.9, 0, 0.9]),
    })

    expect(결과.fumbled).toBe(false)
    expect(결과.errantThrow).toBe(true)
    // 흔들린 공(h' · w' · φ', 중력 70%)을 세계 0xbfed0 이 깔고, 던진 투수는 t ≤ 4 건너뜀 + +0xb1 두 틱으로 빠져
    // 홈 뒤의 포수가 4틱 뒤 가슴 높이로 줍는다 — 보통 포구 틱 갈래(펌블 굴림 · 쥐기)다
    expect(결과.log).toContain('9틱 0루로 송구 — 13틱 도착 (악송구 — 1번 야수가 줍는다) (0번 야수)')
    expect(결과.log).toContain('13틱 1번 야수가 잡았다 (종류 1)')
    // 홈 송구가 빗나가 아무도 안 죽는다 — 사람 수동 송구는 키('8')대로만 던져 1루로는 아무도 안 던졌다
    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.bases).toEqual({ first: true, second: true, third: false })
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
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
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
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      controls: 계속누름('공격', ' '),
    })

    expect(결과.log.some((line) => line.includes('슬라이딩'))).toBe(true)
  })

  it('레이저 송구는 반짝임 창 안에 새로 누른 키가 있어야 나간다 (0x66a8c · 0xb2648 · 0x4e858)', () => {
    const 공통 = {
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      // 굴림 차례: 필살수비 A(0, 성공) → 레이저(0, 성공) → 펌블(0.999, 실패) → 그 뒤 모두 0
      random: 차례난수([0, 0, 0.999, 0]),
    }
    const 굴림 = () => 차례난수([0, 0, 0.999, 0])
    const 눌렀다 = runDefensePlay({ ...공통, random: 굴림(), controls: 계속누름('수비', '2') })
    const 누르고있다 = runDefensePlay({
      ...공통,
      random: 굴림(),
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: true }) },
    })
    const 안눌렀다 = runDefensePlay({ ...공통, random: 굴림(), controls: { side: '수비', keyAt: () => null } })

    expect(눌렀다.laserThrow).toBe(true)
    // 누르고 있기로는 안 된다 — 원본이 키 반복 계수 0 만 받는다
    expect(누르고있다.laserThrow).toBe(false)
    expect(안눌렀다.laserThrow).toBe(false)
  })

  it('레이저 송구는 야수 vtb0 = 0xa222c 로 던진다 — +0xdc = 2000 고정 · 악송구 굴림 없음 (b2f06 · a229c)', () => {
    const 공통 = {
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
    }
    // 굴림 차례: 필살수비 A(0) → 레이저(0) → 펌블(0.999, 실패) → 그 뒤 0 — 0xa1828 의 rand(0,10000) = 0 < 기준이라
    // 0xa1620 송구는 늘 악송구다
    const 굴림 = () => 차례난수([0, 0, 0.999, 0])
    const 레이저 = runDefensePlay({ ...공통, random: 굴림(), controls: 계속누름('수비', '2') })
    const 보통 = runDefensePlay({
      ...공통,
      random: 굴림(),
      controls: { side: '수비', keyAt: () => ({ key: '2', isRepeat: true }) },
    })

    expect(레이저.laserThrow).toBe(true)
    expect(레이저.errantThrow).toBe(false)
    expect(보통.laserThrow).toBe(false)
    expect(보통.errantThrow).toBe(true)
    // 같은 틱에 같은 루로 던져도 레이저(2000)가 먼저 닿는다
    expect(레이저.throwArrivalTick).toBeLessThan(보통.throwArrivalTick)
  })
})

describe('2루 커버가 아닌 키스톤 야수 자리 — 0xb1c90 의 0xb203a (매 틱, 송구 없음)', () => {
  it('중견 앞 2루타에 1루 주자 — 2루 커버는 2루수, 유격수는 AI 0xa 로 표 0xd8764 자리 (14500, 17600) 로 걷는다', () => {
    const state = startDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([102, 866, 910, 0]), // 원본 코드 18
      bases: 주자1루,
      outs: 0,
    })
    const 시작 = state.fielders[5].position
    while (state.tick < 10) stepDefensePlay(state)

    expect(state.covers[2]).toBe(3)
    expect(state.fielders[5].aiState).toBe(0xa)
    expect(state.fielders[5].target).toEqual({ x: 14_500, y: 0, z: 17_600 })
    expect(state.fielders[5].position).not.toEqual(시작)
  })
})

describe('필살타법 성공 타구는 야수가 잡지 못한다 — 공 비트 4 (0x51800 · 0xaf180 · 0xbc3, S13 6절)', () => {
  const 필살타구 = (outcome: AtBatOutcome, bases: BaseState, outs: number, pattern?: BattedBallPattern) =>
    runDefensePlay({
      outcome,
      trajectory: battedBallTrajectory(pattern ?? fixturePatternFor(outcome)),
      bases,
      outs,
      isUncatchable: true,
    })

  it('첫 야수는 쥐지 못하고 0xbc3 · 사건만 난다 — 틱 끝 0xb3148 이 공을 그 야수에게서 튕겨 다시 쏜다', () => {
    const 필살 = 필살타구(뜬공아웃, EMPTY_BASES, 0, 깊은뜬공)

    expect(필살.isUncatchable).toBe(true)
    // 뜬 채로는 아무도 못 잡는다 — 예보(자르지 않은 표)가 고른 중견수가 낙구(26) 전 23틱 포구점에 닿아 맞고 튕긴다
    expect(필살.caughtOnTheFly).toBe(false)
    expect(필살.log).toContain('23틱 8번 야수에게 필살타법 타구가 맞았다 (0xbc3)')
    // 지금 점 속도 → 60% · v0 min(30%, 100) · 각 그대로(난수 없음).
    // 맞은 중견수는 b4588 vt74 → 0xa1e60 으로 +0xb4 = 15 — 새 예보의 복제가 그 잠금을 물려받아 t = 5(건너뛴 4틱 뒤) ~ 19 는 판정이 없다
    expect(필살.log).toContain('23틱 공 튕김 (0xb3148) — 속도 537 · v0 100 · 각 -92 · 8번 야수가 61틱에 줍는다')
  })

  it('다시 쏜 공은 보통 공이다 — 속성 목록 +0x5c 를 0xa2610 이 비워 새 예보의 야수가 그대로 쥔다', () => {
    const 필살 = 필살타구(땅볼아웃, EMPTY_BASES, 0)

    const 맞음 = 필살.log.findIndex((line) => line.includes('필살타법 타구가 맞았다'))
    const 잡음 = 필살.log.findIndex((line) => line.includes('잡았다'))
    expect(맞음).toBeGreaterThanOrEqual(0)
    expect(잡음).toBeGreaterThan(맞음)
    // 맞은 투수는 15틱 잠금(+0xb4) — 예보에서 빠지고(가까운 야수 0xb3c4c 도 잠금이면 건너뜀) 유격수가 줍는다
    expect(필살.log[잡음]).toBe('23틱 5번 야수가 잡았다 (종류 0)')
  })

  it('튕기는 동안에도 3루 주자는 홈을 밟는다', () => {
    const 필살 = 필살타구(뜬공아웃, 주자3루, 2, 깊은뜬공)

    expect(필살.advance.runsScored).toBe(1)
  })
})

describe('수비 아홉 칸 능력치 — 자리 코드 −1 이 칸 번호다 (0xb103e~0xb105e)', () => {
  it('자리 코드 2~9 가 칸 1~8 로 가고, 칸 0(투수)은 따로 받는다', () => {
    const 능력치 = defenseAbilitiesOf(
      [
        { position: 2, defense: 610 }, // 포수 → 칸 1
        { position: 3, defense: 620 }, // 1루수 → 칸 2
        { position: 9, defense: 690 }, // 중견 → 칸 8
        { position: 1, defense: 999 }, // 지명 — 수비 자리가 없다
        { position: 0, defense: 999 }, // 후보 — 자리 없음
      ],
      333,
    )

    expect(능력치).toHaveLength(FIELDER_COUNT)
    expect(능력치[0]).toBe(333)
    expect(능력치[1]).toBe(610)
    expect(능력치[2]).toBe(620)
    expect(능력치[8]).toBe(690)
    // 못 채운 칸은 원본 평균대(등급 3)로 둔다
    expect(능력치[3]).toBe(500)
  })

  it('같은 자리가 두 번 나오면 앞 선수가 이긴다 — 뒤는 후보다', () => {
    expect(defenseAbilitiesOf([{ position: 4, defense: 700 }, { position: 4, defense: 100 }])[3]).toBe(700)
  })

  it('안 주면 아홉 칸 모두 500 이다 — 지금까지의 기본값 그대로', () => {
    expect(defenseAbilitiesOf([])).toEqual(Array.from({ length: FIELDER_COUNT }, () => 500))
  })
})

describe('협살 — AI 상태 8 (0xb48b6 · 시작 0xb3a94, S8 1절)', () => {
  // 판 시작 리드(0x3d7b8) 뒤로 대표 단타는 협살이 안 선다 — 1루 주자가 3루까지 노리다 2·3루 사이에 갇히는 깊은 타구.
  // 송구를 준비 틱이 끝난 틱(포구 + R)에 고른 뒤로 [95,1299,785,0] 은 2루로 던져 협살이 안 선다 — 같은 모양의 타구로 바꿨다
  const 협살상황 = (defenseIsCpu: boolean) =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([85, 1203, 600, 0]), // 원본 코드 15
      bases: 주자1루,
      outs: 0,
      defenseIsCpu,
    })

  it('수비가 CPU 일 때만 걸린다 — 사람이 수비하면 원본에서도 안 일어난다 (state[0x31+수비측])', () => {
    expect(협살상황(true).log.some((line) => line.includes('협살 시작'))).toBe(true)
    expect(협살상황(false).log.some((line) => line.includes('협살 시작'))).toBe(false)
  })

  it('안 주면 안 돈다 — 부르는 쪽이 말해 주지 않으면 시작하지 않는다', () => {
    const 기본 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([85, 1203, 600, 0]),
      bases: 주자1루,
      outs: 0,
    })

    expect(기본.rundowns).toBe(0)
    expect(기본.log.some((line) => line.includes('협살'))).toBe(false)
  })

  it('송구가 닿으면 공은 받은 야수의 손으로 옮겨 간다 — 그래야 협살 조건이 선다 (0xb2734)', () => {
    const 결과 = 협살상황(true)
    const 시작 = 결과.log.find((line) => line.includes('협살 시작'))

    expect(결과.rundowns).toBe(1)
    // 3루로 간 송구를 받은 3루수(4)와 2루 커버 유격수(5)가 1번 주자를 2·3루 사이에 둔다
    expect(시작).toContain('1번 주자 2↔3루')
  })

  it('**주자가 안 되돌면 태그가 안 난다** — 원본에도 주자 쪽 협살 AI 가 없다', () => {
    // 자동 주루(0xaf918)는 앞으로 가는 판정만 한다. 뒤를 쫓는 야수는 220/틱, 주자는 ≈335/틱 이라
    // 절대 못 따라잡고, 주자가 루에 35% 미만으로 붙으면 고르기(0xb398c)가 −1 이 되어 협살이 풀린다.
    const 결과 = 협살상황(true)

    expect(결과.rundowns).toBe(1)
    expect(결과.rundownOuts).toBe(0)
    expect(결과.log.some((line) => line.includes('협살 태그'))).toBe(false)
  })

  it('사람이 귀루 키를 누르면 되돌아 뛰다가 태그로 죽는다 — 협살이 서기 전에 아웃 판정이 먼저 잡는다', () => {
    // 협살은 수비가 CPU 일 때만 걸리므로 공격은 늘 사람이다. 되돌아 뛰는 것은 귀루 키('3' = 1루 주자,
    // 메시지 0x584)이고, 아웃은 거리 ≤ 499 태그(0xb36d0 결과 3)다.
    //
    // ⚠️ **예전에는 이 아웃이 `rundownOuts` 로 셌다.** 그때는 진행기가 아웃 판정을 협살 갈래 안에서만
    // 돌렸기 때문이다. 이제는 원본대로 아웃 판정 `0xb36d0` 이 **공을 쥘 때마다·틱마다** 돌고,
    // 원본 플레이 틱 `0xb401c` 의 차례가 **vt90(0xb42f2) → 협살 시작(0xb433c~0xb4378) → vt90(0xb43de)**
    // 이라 **송구를 받는 그 틱의 아웃 판정이 협살 기록칸보다 먼저** 이 주자를 잡는다.
    // 그래서 협살은 아예 서지 않고, 아웃은 협살 아웃이 아니라 평범한 태그 아웃으로 난다.
    // 원본 코드 20 [47, 1038, 596] — 우익수가 20틱에 줍고 26틱에 2루로 던진다. 송구 0xb2e38 의 vt34(0xb3b38)가 받을
    // 유격수를 던지는 틱부터 +0x130 으로 세우므로 공이 날아가는 27틱에 1번 주자(2↔3루) 협살 기록칸이 먼저 선다
    // (0xb3fa8 은 +0x130 만 본다). 32틱 귀루로 주자가 2루 쪽에 붙어 그 협살은 풀리고, 받는 쪽의 아웃 판정이 평범한 태그로 잡는다.
    // (예전의 원본 코드 18 [5] 는 결과를 먼저 정하던 다리 없이 돌리면 좌익수가 뜬 채로 잡는 공이다)
    const 결과 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([47, 1038, 596, 0]),
      bases: { first: true, second: true, third: false },
      outs: 0,
      defenseIsCpu: true,
      controls: { side: '공격', keyAt: (tick) => (tick === 32 ? { key: '3' } : null) },
    })

    expect(결과.log.some((line) => line.includes('귀루'))).toBe(true)
    expect(결과.rundowns).toBe(1)
    expect(결과.rundownOuts).toBe(0)
    expect(결과.log.some((line) => line.includes('태그 아웃 (0xb36d0 결과 3)'))).toBe(true)
  })

  it('같은 귀루 키도 **누르고 있어서 되풀이된 사건**이면 안 먹는다 — 원본 [조작+0x1c] & 0xf0 (0x53370~0x53390)', () => {
    // 바로 위 시험과 같은 판에서 키만 "반복"(브라우저 KeyboardEvent.repeat = 원본 경기+0x6c 비트 4~7)으로 준다.
    const 같은판 = (isRepeat: boolean) =>
      runDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([47, 1038, 596, 0]),
        bases: { first: true, second: true, third: false },
        outs: 0,
        defenseIsCpu: true,
        controls: { side: '공격', keyAt: (tick) => (tick === 32 ? { key: '3', isRepeat } : null) },
      })
    const 반복 = 같은판(true)

    expect(반복.log.some((line) => line.includes('귀루'))).toBe(false)
    expect(반복.log.some((line) => line.includes('태그 아웃 (0xb36d0 결과 3)'))).toBe(false)
    // 새로 누른 키(반복 아님)는 그대로 먹는다
    expect(같은판(false).log.some((line) => line.includes('귀루'))).toBe(true)
    // 전원 귀루(CLR)는 게이트가 없어 반복이어도 먹는다
    const 전원 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([47, 1038, 596, 0]),
      bases: { first: true, second: true, third: false },
      outs: 0,
      defenseIsCpu: true,
      controls: { side: '공격', keyAt: (tick) => (tick === 32 ? { key: 'Escape', isRepeat: true } : null) },
    })
    expect(전원.log.some((line) => line.includes('귀루'))).toBe(true)
  })

  it('타자주자도 협살 대상이다 — 걸렸다가 3루에 살아 서면 판 끝 정산이 3루타로 적는다', () => {
    // 원본 고르기 0xb398c 는 뒤 주자부터 보므로 타자주자(0번)는 다른 주자가 없을 때만 뽑힌다 — 예전 웹은 0번을 아예 뺐다
    const 결과 = runDefensePlay({
      outcome: 삼루타,
      trajectory: battedBallTrajectory(fixturePatternFor(삼루타)),
      bases: EMPTY_BASES,
      outs: 0,
      defenseIsCpu: true,
    })

    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.bases).toEqual({ first: false, second: false, third: true })
    expect(결과.rundowns).toBe(1)
    expect(결과.log.some((line) => line.includes('협살 시작 — 0번 주자'))).toBe(true)
    expect(결과.rundownOuts).toBe(0)
    expect(결과.outcome).toEqual(삼루타)
  })
})

describe('화면 스냅샷 배선 — 번쩍임 · 마선수 그림 · 팀 팔레트 (R2 2절 · C-16 · C-1)', () => {
  /** 필살 슬라이딩 캐치가 골라지는 원본 패턴 (코드 15) — 창이 열려야 골라진다 */
  const 슬라이딩캐치패턴: BattedBallPattern = [49, 802, 799, 0]
  /** 필살 점프 캐치가 골라지는 원본 패턴 (코드 15) */
  const 점프캐치패턴: BattedBallPattern = [126, 674, 811, 0]

  it('안 넘기면 지금까지와 똑같다 — 번쩍임 없음 · 보통 수비수 그림 · 팔레트 없음', () => {
    const 결과 = play(땅볼아웃, EMPTY_BASES, 0)

    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
    expect(결과.ticks[0].fielders.every((야수) => 야수.aceIndex === null)).toBe(true)
    expect(결과.ticks[0].fielders.every((야수) => 야수.teamIndex === null)).toBe(true)
    expect(결과.ticks[0].runners.every((주자) => 주자.teamIndex === null)).toBe(true)
  })

  it('마선수 번호와 팀 번호가 화면 스냅샷까지 내려간다', () => {
    const 결과 = runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 주자1루,
      outs: 0,
      // 칸 6(유격) 이 마선수 2번(로제) — 나머지는 보통 수비수 그림
      aceIndexes: [null, null, null, null, null, null, 2, null, null],
      defenseTeamIndex: 4,
      offenseTeamIndex: 11,
    })

    const 첫틱 = 결과.ticks[0]
    expect(첫틱.fielders[6].aceIndex).toBe(2)
    expect(첫틱.fielders[5].aceIndex).toBeNull()
    expect(첫틱.fielders.every((야수) => 야수.teamIndex === 4)).toBe(true)
    expect(첫틱.runners.every((주자) => 주자.teamIndex === 11)).toBe(true)
  })

  it('번쩍임은 필살 포구에서만 뜬다 — 보통 포구 타구에는 한 틱도 없다', () => {
    // 레이저 반짝임(경기+0x19ad)은 deadly_effect 가 아니다 — 켜도 번쩍임이 뜨지 않는다
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
      random: 고정난수(0),
      controls: { side: '수비', keyAt: () => null },
    })

    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
  })

  it('필살 점프 캐치가 나가는 틱에 번쩍임 B 가 뜬다 (플레이+0x1f7, 0xd87f4 종류 3)', () => {
    // 굴림 차례: 필살수비 A(점프) 성공 → 나머지 실패. 원본 굴림 순서 그대로다
    const 결과 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(점프캐치패턴),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0, 0.9]),
    })

    expect(결과.specialDefense).toEqual({ jumpUnlocked: true, slideUnlocked: false })
    const 번쩍임 = 결과.ticks.filter((틱) => 틱.flash?.kind === 'b')
    expect(번쩍임.length).toBeGreaterThan(0)
    // deadly_effect 애니 0 은 네 칸이고 마지막 칸에서 멈춘다. 점프는 방향 칸을 안 쓴다
    expect(번쩍임[0].flash?.step).toBe(0)
    expect(번쩍임.every((틱) => (틱.flash?.step ?? 0) <= 3)).toBe(true)
    expect(번쩍임.every((틱) => 틱.flash?.direction === undefined)).toBe(true)
  })

  it('필살 슬라이딩 캐치가 나가는 틱에 방향이 달린 번쩍임 C 가 뜬다 (플레이+0x1f8, 종류 4)', () => {
    // 굴림 차례: A(점프) 실패 → B(슬라이딩) 성공 → 나머지 실패
    const 결과 = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(슬라이딩캐치패턴),
      bases: EMPTY_BASES,
      outs: 0,
      random: 차례난수([0.9, 0, 0.9]),
    })

    expect(결과.specialDefense).toEqual({ jumpUnlocked: false, slideUnlocked: true })
    const 번쩍임 = 결과.ticks.filter((틱) => 틱.flash?.kind === 'c')
    expect(번쩍임.length).toBeGreaterThan(0)
    // 방향 값은 슬라이딩 캐치 동작 번호 0xf~0x12 와 같은 칸을 쓴다
    expect(번쩍임.every((틱) => (틱.flash?.direction ?? 0) >= 0xf && (틱.flash?.direction ?? 0) <= 0x12)).toBe(true)
  })
})

describe('레이저 송구 반짝임이 화면까지 내려간다 (경기+0x19ad — 0x43406~0x4342c)', () => {
  const 공통 = {
    outcome: 단타,
    trajectory: battedBallTrajectory(fixturePatternFor(단타)),
    bases: 주자1루,
    outs: 0,
  }

  it('CPU 수비면 굴림은 돌되 반짝이지 않는다 — 곧바로 경기+0x19ae (0x52468~0x52484)', () => {
    // 0x523bc 는 수비 주체를 보지 않고 굴린 뒤(0x52456), 통과했을 때만
    // `경기[0x31 + 경기[0xa]]` 로 갈린다 — 0 이면 사람 → `+0x19ad`(반짝임),
    // 아니면 CPU → `+0x19ae`(반짝임 없이 곧바로 레이저).
    const cpu수비 = runDefensePlay({ ...공통, random: 고정난수(0.02), defenseIsCpu: true })
    const 공격조작 = runDefensePlay({
      ...공통,
      random: 고정난수(0.02),
      defenseIsCpu: true,
      controls: 계속누름('공격', ' '),
    })

    expect(cpu수비.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
    expect(공격조작.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
  })

  it('CPU 수비 타구도 난수를 한 번 더 뽑는다 — 굴림이 갈림 앞에 있다 (0x52456)', () => {
    // 이 한 번이 빠져 있어서 같은 씨앗인데도 CPU 수비 쪽 난수 차례가 원본과 어긋났다.
    const 뽑은수 = (extra: Partial<DefensePlayInput>) => {
      let count = 0
      const random: RandomPort = {
        next: () => {
          count += 1
          return 0.9
        },
        nextInRange: (minimum, maximum) => (minimum + maximum) / 2,
        pick: (candidates) => candidates[0],
      }
      runDefensePlay({ ...공통, random, ...extra })
      return count
    }

    // 사람 쪽은 송구 자동 — 키 없는 수동 송구는 안 던져서 악송구 굴림이 빠지기 때문이다
    expect(뽑은수({ defenseIsCpu: true })).toBe(뽑은수({ defenseIsCpu: false, throwMode: '자동' }))
  })

  it('굴림이 통과하면 **공 쥔 야수 칸**이 실린다 (플레이+0x130)', () => {
    // 0.02 는 레이저 기준(등급 3 = 60/1000)은 넘고 펌블·필살수비 기준에는 안 걸리는 값이다
    const 결과 = runDefensePlay({
      ...공통,
      random: 고정난수(0.02),
      controls: { side: '수비', keyAt: () => null },
    })

    const 반짝틱 = 결과.ticks.filter((틱) => 틱.laserShiningSlot !== null)
    // 창은 포구 −10 ~ +8틱인데 그중 **공을 쥔 뒤**만 그려진다 — 9틱
    expect(반짝틱.length).toBe(9)
    // 공을 쥔 뒤에만 그린다 — 포구 틱 앞은 창이 열려 있어도 안 그린다 (0x43406 의 첫 조건)
    expect(반짝틱.every((틱) => 틱.tick >= 결과.catchTick)).toBe(true)
    expect(반짝틱.every((틱) => 틱.laserShiningSlot === 결과.catchFielderSlot)).toBe(true)
  })

  it('굴림이 떨어지면 안 반짝인다 — deadly_effect 번쩍임과도 겹치지 않는다', () => {
    const 결과 = runDefensePlay({
      ...공통,
      random: 고정난수(0.999),
      controls: { side: '수비', keyAt: () => null },
    })

    expect(결과.ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
    expect(결과.ticks.every((틱) => 틱.flash === null)).toBe(true)
  })
})

describe('주루 수동/자동 — 설정 +0xbd 와 0xae690 (직접 뜬 것)', () => {
  // 원본 배선(경기 장면 슬롯 2 = 0x524c0 안, 매 틱):
  //   5262e: 0xae690([장면+0x214], 설정+0xbd)
  //          = (경기[0x31 + 경기[9](공격측)] == 1)  ||  (설정+0xbd != 0)
  //   52638~5265e: 거짓이면 플레이+0x111·+0x129·종류 7 만 예외로 통과
  //   52660: 0xaf8c0(장면+0x210, 0) = 제어기.vt8 = 0xaf918 자동 추가 진루
  // ⚠️ 경기+0x24 는 이 갈림에 끼지 않는다 — 읽는 곳이 0x3e0e6·0x521fa 둘뿐이고
  //    둘 다 "투구 뒤 종류 5 수비 화면을 열까" 와 도루 칸 세우기다.
  const 깊은뜬공주자3루 = (extra: Partial<DefensePlayInput> = {}) =>
    runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory(깊은뜬공),
      bases: 주자3루,
      outs: 0,
      runAbility: 500,
      ...extra,
    })

  it('자동이면 태그업으로 들어온다 — 안 넘겼을 때와 한 톨도 다르지 않다', () => {
    const 안넘김 = 깊은뜬공주자3루()
    const 자동 = 깊은뜬공주자3루({ runningMode: '자동' })

    expect(안넘김.advance).toEqual(자동.advance)
    expect(자동.advance.runsScored).toBe(1)
  })

  it('수동이면 자동 진루가 통째로 안 돈다 — 3루 주자가 그 자리에 선다', () => {
    const 수동 = 깊은뜬공주자3루({ runningMode: '수동' })

    expect(수동.advance.runsScored).toBe(0)
    expect(수동.advance.bases.third).toBe(true)
    // 뜬공 아웃 하나는 결과 코드가 정한 것이라 수동이어도 그대로다
    expect(수동.advance.outsAdded).toBe(1)
  })

  it('공격이 CPU 면 설정이 수동이어도 돈다 — 0xae690 의 앞 항', () => {
    const CPU공격 = 깊은뜬공주자3루({ runningMode: '수동', offenseIsCpu: true })

    expect(CPU공격.advance).toEqual(깊은뜬공주자3루({ runningMode: '자동' }).advance)
  })

  it('수동이어도 사람이 진루 키를 누르면 주자는 뛴다 — 수동은 "사람이 전부 누른다" 는 뜻이다', () => {
    const 가만히 = 깊은뜬공주자3루({ runningMode: '수동' })
    const 눌렀다 = 깊은뜬공주자3루({ runningMode: '수동', controls: 계속누름('공격', '8') })

    expect(가만히.log.some((line) => line.includes('진루'))).toBe(false)
    expect(눌렀다.log.some((line) => line.includes('진루'))).toBe(true)
    expect(눌렀다.advance.runsScored).toBe(1)
  })

  it('난수 굴림 차례는 수동/자동에 한 톨도 안 흔들린다', () => {
    const 굴림수 = (mode: '수동' | '자동') => {
      let calls = 0
      let seed = 12345
      const 하나 = () => {
        calls += 1
        seed = (seed * 1664525 + 1013904223) >>> 0
        return (seed >>> 8) / 0x1000000
      }
      const random: RandomPort = {
        next: 하나,
        nextInRange: (minimum, maximum) => minimum + 하나() * (maximum - minimum),
        pick: (candidates) => candidates[Math.floor(하나() * candidates.length)],
      }
      깊은뜬공주자3루({ runningMode: mode, random })
      return calls
    }

    expect(굴림수('수동')).toBe(굴림수('자동'))
  })
})

describe('1루 주자 예외 — 0xa9e44 a9ed6: 2아웃 전 잡힐 뜬공이면 1루 주자는 포스 목표를 안 받는다', () => {
  // 판 첫 틱의 목표 루(그림의 base) — 리드(0x3d7b8) 뒤 목표를 판 시작 때의 목표로 되돌리므로 이 값이 0xa9e44 의 답이다
  const 첫목표 = (outcome: AtBatOutcome, bases: BaseState, outs: number, stealingFrom: (1 | 2 | 3)[] = []) =>
    runDefensePlay({
      outcome,
      trajectory: battedBallTrajectory(fixturePatternFor(outcome)),
      bases,
      outs,
      runAbility: 500,
      stealingFrom,
    }).ticks[0].runners.map((runner) => runner.base)

  it('0·1아웃 뜬공: 1루 주자도 그 앞 주자도 제 루가 목표다 — 사슬이 1루에서 끊긴다', () => {
    expect(첫목표(뜬공아웃, 주자1루, 0)).toEqual([1, 1])
    expect(첫목표(직선타아웃, 만루, 1)).toEqual([1, 1, 2, 3])
  })

  it('땅볼은 예외가 아니다 — 1루부터 밀린다', () => {
    expect(첫목표(땅볼아웃, 만루, 0)).toEqual([1, 2, 3, 0])
  })

  it('2아웃이면 예외가 없고 모든 주자가 친 순간 다음 루로 간다 (a9ef6)', () => {
    expect(첫목표(뜬공아웃, 만루, 2)).toEqual([1, 2, 3, 0])
  })

  it('도루 표시가 선 1루 주자는 +0x7c 가 이미 2 라 2루 주자는 밀린다 (a9eec 가 앞 주자 +0x7c 를 본다)', () => {
    expect(첫목표(뜬공아웃, { first: true, second: true, third: false }, 0, [1])).toEqual([1, 2, 3])
  })
})

describe('포스 사슬 — 머리는 늘 "타자주자 → 1루" (`createPlayRunners` · 0xa9f60)', () => {
  // 원본에는 "이 타구는 2루타" 라는 결과 코드가 없다. 타자주자가 2루까지 가면 그게 2루타다(판 끝 정산 0xa8024).
  // 그래서 포스 사슬 머리는 늘 "타자주자 → 1루" 고, 그 뒤는 루가 이어 차 있는 만큼만 밀린다. 원본은
  // **한 루에 산 주자를 둘 놓지 않는다**("루 b 의 주자" 0xa97a0 · 주루 키의 앞길/뒷길 검사 0xa99a8 · 0xa9924, I 3b).
  // (예전 웹은 타석 결과 코드가 준 최소 루 M 을 사슬 머리로 썼다 — 결과를 먼저 정한 웹 다리라 걷었다.)
  const 진루 = (bases: BaseState) => [bases.first, bases.second, bases.third]
  /** 원본 코드 18 [0] — 좌중간으로 빠지는 단타 */
  const 외야단타 = battedBallTrajectory([69, 1000, 700, 0])
  const 단타판 = (bases: BaseState, runningMode: '수동' | '자동') =>
    runDefensePlay({ outcome: 단타, trajectory: 외야단타, bases, outs: 0, runAbility: 500, runningMode, throwMode: '자동' })

  it('사람 공격 · 주루 수동이면 자동 진루(0xaf918)가 안 돌아 포스로 밀린 만큼만 간다 — 타자주자 1루 · 1루 주자 2루', () => {
    const 수동 = 단타판({ first: true, second: false, third: true }, '수동')

    // 3루 주자는 포스가 아니라(2루가 비어 사슬이 끊긴다) 제자리 — 사람이 키를 안 눌렀다
    expect(수동.advance.bases).toEqual({ first: true, second: true, third: true })
    expect(수동.advance.runsScored).toBe(0)
    expect(수동.outcome).toEqual(단타)
  })

  it('주루 자동이면 그 위에서 자동 진루가 더 보낸다 — 3루 주자 득점', () => {
    const 자동 = 단타판({ first: true, second: false, third: true }, '자동')

    expect(자동.advance.runsScored).toBe(1)
    expect(자동.outcome).toEqual(단타)
  })

  it('바운드로 담장을 넘은 공(결과 코드 10)은 종류 7 무조건 진루 — 수동이어도 투구 때 루 + 2 까지 가고 2루타로 적는다', () => {
    const 한주자 = play2(이루타, 주자1루, 0, '수동')
    expect(한주자.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(한주자.outcome).toEqual(이루타)

    const 만루 = play2(이루타, { first: true, second: true, third: true }, 0, '수동')
    expect(만루.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(만루.advance.runsScored).toBe(2)

    const 삼루만 = play2(이루타, 주자3루, 0, '수동')
    expect(진루(삼루만.advance.bases)).toEqual([false, true, false])
    expect(삼루만.advance.runsScored).toBe(1)
  })

  it('어느 갈래에서도 두 주자가 한 루에 겹치거나 앞 주자가 뒤로 밀리지 않는다', () => {
    const 루상황: BaseState[] = [
      EMPTY_BASES,
      주자1루,
      { first: false, second: true, third: false },
      주자3루,
      { first: true, second: true, third: false },
      { first: true, second: false, third: true },
      { first: false, second: true, third: true },
      만루,
    ]
    for (const outcome of [땅볼아웃, 뜬공아웃, 직선타아웃, 단타, 이루타, 삼루타]) {
      for (const bases of 루상황) {
        for (const mode of ['자동', '수동'] as const) {
          const 결과 = play2(outcome, bases, 0, mode)
          const 칸수 = 진루(결과.advance.bases).filter(Boolean).length
          const 주자수 = 1 + 진루(bases).filter(Boolean).length
          const 자리 = `${outcome.kind}/${진루(bases).join()}/${mode}`
          // **주자 수지 맞추기**: 득점 + 아웃 + 루에 선 주자 = 이 플레이에 있었던 주자 수.
          // 둘이 한 루에 겹치면 `basesOf` 가 하나를 지워 이 합이 모자란다 — 증발을 바로 잡아낸다.
          expect([자리, 결과.advance.runsScored + 결과.advance.outsAdded + 칸수]).toEqual([자리, 주자수])
        }
      }
    }
  })
})
describe('송구 수동/자동 — 환경설정 +0xf4 (0x5269c → 0xae6c8 → 0xafa60)', () => {
  // 원본 갈림(직접 뜬 것, 매 틱 도는 경기 장면 슬롯 2 = 0x524c0 안, 주루 갈림 바로 아래):
  //   5269c: r1 = 설정+0xf4 ; 526a4: bl 0xae6c8([장면+0x214], r1)
  //          → 반환 = (경기[0x31 + 경기[0xa](수비측)] == 1) || (설정+0xf4 != 0)
  //   526ac: 0 이면 건너뛴다 ; 526ae: 0xaf8e0 = 제어기.vt0xc = 0xafa60 CPU 송구 결정 → 점수식 0xafb24
  // 곧 사람이 수비하면서 설정이 수동이면 점수식이 아예 안 돈다. 그때 목표는 플레이 vt0x30 =
  // 0xb1c90 이 고른다 — 사람이 누른 목표(+0x160)가 먼저고, 안 눌렀으면 "앞선 주자부터 잡히는 첫 루".
  const 송구줄 = (result: DefensePlayResult) =>
    result.log.find((line) => line.includes('루로') && line.includes('송구')) ?? '(송구 없음)'

  const 만루단타 = (extra: Partial<DefensePlayInput> = {}): DefensePlayResult =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(fixturePatternFor(단타)),
      bases: 만루,
      outs: 0,
      runAbility: 500,
      ...extra,
    })

  it('안 넘기면 원본 기본값(수동)이다 — 설정 +0xf4 의 생성자 값이 0 이다', () => {
    expect(송구줄(만루단타())).toBe(송구줄(만루단타({ throwMode: '수동' })))
  })

  it('수동이면 키를 안 누른 사람 수비는 던지지 않는다 — 0xb1c90 자동 가지에는 송구 호출이 없다', () => {
    // 공을 내보내는 호출(플레이.vt58 0xb2c90 · vt5c 0xb2e38)은 0xafa60(CPU 결정) · b4660(+0x160 사람 목표) ·
    // 앞선 송구가 세운 중계/AI 상태 9 · 견제 · CPU 협살뿐이다. 0x509a0 앞머리는 빈 함수 0xae5f8 을 부른다.
    const 단타궤적 = battedBallTrajectory([90, 900, 350, 1]) // 원본 코드 3 — 투수가 바운드 뒤 5틱에 줍는다
    const 수동 = 만루단타({ throwMode: '수동', trajectory: 단타궤적 })
    expect(수동.throwBase).toBe(-1)
    expect(송구줄(수동)).toBe('(송구 없음)')
    // 자동이면 점수식이 루를 고른다 — 만루라 홈 포스
    expect(만루단타({ throwMode: '자동', trajectory: 단타궤적 }).throwBase).toBe(0)
  })

  it('포구 뒤에 누른 키는 준비 틱이 지난 뒤 그 틱에 던진다 — 플레이 틱 b4660~b46a8', () => {
    const 단타궤적 = battedBallTrajectory([92, 698, 565, 0])
    const 키없음 = 만루단타({ throwMode: '수동', trajectory: 단타궤적 })
    const 누른틱 = 키없음.catchTick + 8
    const 늦게 = 만루단타({
      throwMode: '수동',
      trajectory: 단타궤적,
      controls: { side: '수비', keyAt: (tick) => (tick === 누른틱 ? { key: '6', isRepeat: false } : null) },
    })

    expect(늦게.throwBase).toBe(1)
    expect(늦게.log.some((line) => line.startsWith(`${누른틱}틱 1루로 송구`))).toBe(true)
  })

  it('사람 수동에서도 아웃이 난 틱 끝에는 CPU 송구 결정이 한 번 돈다 — 결과 메시지 0xbba → 0x51d40 → 0xafa60', () => {
    // 만루 번트(원본 코드 7)를 포수가 잡아 들고 있는데 홈으로 밀려 오는 3루 주자가 옆을 지나다 태그(0xb36d0 결과 3)된다 →
    // 결과 코드 13 → 0x51d40 이 수비 조작이 사람이어도 `아웃 ≤ 2` 면 0xafa60 을 부른다 → 점수식이 1루를 고른다(병살)
    const 결과 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([114, 201, 125, 1]),
      bases: 만루,
      outs: 1,
      runAbility: 500,
      throwMode: '수동',
    })
    const 태그 = 결과.log.find((line) => line.includes('태그 아웃'))
    expect(태그).toBeDefined()
    const 아웃틱 = 태그!.split('틱')[0]
    expect(아웃틱).toBe('13')
    expect(결과.log.some((line) => line.startsWith(`${아웃틱}틱 1루로 송구`) && line.includes('CPU 결정'))).toBe(true)
    expect(결과.throwBase).toBe(1)
    expect(결과.advance.outsAdded).toBe(2)
    // 2아웃째(이 판의 첫 아웃 + 1)라 `아웃 ≤ 2` — 3아웃이었다면 돌지 않는다
    const 셋째 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([114, 201, 125, 1]),
      bases: 만루,
      outs: 2,
      runAbility: 500,
      throwMode: '수동',
    })
    expect(셋째.log.some((line) => line.includes('태그 아웃'))).toBe(true)
    expect(셋째.log.some((line) => line.includes('CPU 결정'))).toBe(false)
  })

  describe('받은 야수의 이어 던지기 — 쥐기 0xb2710(+0x128 = 1) · 슬롯 2 의 0xafa60 · 결과 메시지 0xbba', () => {
    // 만루 땅볼 — 투수가 잡아 홈으로 던지고(포스), 받은 포수(1)가 준비 틱 3 이 지난 뒤 다시 고른다 — 1루로 던져 병살
    const 이어던지기 = (extra: Partial<DefensePlayInput>) =>
      runDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([90, 900, 350, 1]), // 원본 코드 3
        bases: 만루,
        outs: 0,
        runAbility: 500,
        ...extra,
      })
    const 송구들 = (결과: { log: readonly string[] }) => 결과.log.filter((line) => line.includes('송구 —'))

    it('CPU 수비는 받은 야수가 준비 틱(내야 3)이 지난 틱에 점수식으로 이어 던진다', () => {
      const 결과 = 이어던지기({ defenseIsCpu: true })
      const [첫, 둘] = 송구들(결과)

      // 받는 점 (홈 목표 x, 1000, z) 를 점[T − 1] 에 끼워 넣어(b2f9c) 포수가 11틱에 받는다
      expect(첫).toBe('8틱 0루로 송구 — 11틱 도착 (CPU 결정) (0번 야수)')
      expect(결과.log).toContain('11틱 3번 주자 루 아웃 (0xb36d0 결과 2)')
      // 11틱에 받아(+0xc8 = 3) 준비 틱이 지난 뒤 0xafa60 이 1루를 고른다(타자주자가 0↔1루 협살에 걸려 있던 틱은 못 던진다)
      expect(둘).toMatch(/^1[45]틱 1루로 송구 — \d+틱 도착 \(CPU 결정\) \(1번 야수\)$/)
      expect(결과.log.some((line) => line.includes('0번 주자 루 아웃'))).toBe(true)
      expect(결과.advance.outsAdded).toBe(2)
      // 결과의 송구 칸은 첫 송구다
      expect(결과.throwBase).toBe(0)
    })

    it('받는 것도 포구 틱 갈래다 — 펌블 굴림 b4228 을 먹고, 움직이는 송구공을 놓치면 0xb3148 로 튕긴다 (b307c → 포구 틱)', () => {
      const 결과 = 이어던지기({ defenseIsCpu: true, random: createSeededRandom(81) })

      expect(결과.log).toContain('8틱 0루로 송구 — 11틱 도착 (CPU 결정) (0번 야수)')
      expect(결과.log).toContain('11틱 1번 야수 펌블 (0xbc2)')
      expect(결과.log).toContain('11틱 공 튕김 (0xb3148) — 속도 579 · v0 37 · 각 77 · 1번 야수가 25틱에 줍는다')
      expect(결과.log).toContain('25틱 1번 야수가 잡았다 (종류 0)')
      expect(결과.fumbled).toBe(true)
    })

    it('송구 설정이 자동이면 사람 수비도 같은 점수식으로 이어 던진다 — 0xae6c8 의 뒤 항', () => {
      const 사람 = 송구들(이어던지기({ throwMode: '자동' }))
      const CPU = 송구들(이어던지기({ defenseIsCpu: true }))
      expect(사람[0]).toBe(CPU[0])
      // 둘째 송구 틱만 다를 수 있다 — 협살(타자주자 0↔1루)은 CPU 수비에서만 서서(state[0x31+수비측]) 그동안 못 던진다
      expect(사람[1]).toMatch(/^14틱 1루로 송구 — \d+틱 도착 \(CPU 결정\) \(1번 야수\)$/)
      expect(CPU[1]).toMatch(/^15틱 1루로 송구 — \d+틱 도착 \(CPU 결정\) \(1번 야수\)$/)
    })

    it('사람 수비·수동 송구는 이어 던지지 않는다 — 받는 틱의 아웃은 준비 틱이 막고, 그 뒤 0xafa60 을 부르는 곳이 없다', () => {
      // 키를 홈으로 한 번 누르면 투수가 던지고, 받은 포수는 공을 들고 있다 — 받는 틱의 포스 아웃(결과 코드 13)에 0x51d40 이
      // 0xafa60 을 한 번 부르지만 쥐기가 막 넣은 준비 틱 때문에 못 던지고, 그 뒤로는 부르는 곳이 없다
      const 결과 = 이어던지기({
        throwMode: '수동',
        controls: { side: '수비', keyAt: (tick) => (tick === 0 ? { key: '8', isRepeat: false } : null) },
      })

      expect(송구들(결과)).toHaveLength(1)
      expect(결과.log.some((line) => line.includes('0번 주자 루 아웃'))).toBe(false)
    })

    it('송구가 날아가는 동안은 아무도 공을 쥐지 않는다 — b2f80 야수+0xe0 = 0 · b3070 +0x12c = 0', () => {
      const state = startDefensePlay({
        outcome: 이루타,
        trajectory: battedBallTrajectory([90, 900, 350, 1]),
        bases: 만루,
        outs: 0,
        runAbility: 500,
        defenseIsCpu: true,
      })
      while (state.tick <= 9) stepDefensePlay(state)

      expect(state.play.held).toBe(false)
      expect(state.fielders.some((fielder) => fielder.holdingBall)).toBe(false)
      // 0xb3b38 의 "잡을 야수"(+0x170)·"받는 틱"(+0x174)은 받을 포수 · 송구공 예보의 포구 틱이다 (vt24(0) 다시 예보)
      expect(state.play.catchFielderSlot).toBe(1)
      expect(state.play.catchTick).toBe(11)
    })
  })

  it('수비가 CPU 면 설정이 수동이어도 점수식이 돈다 — 0xae6c8 의 앞 항', () => {
    expect(만루단타({ throwMode: '수동', defenseIsCpu: true }).throwBase).toBe(
      만루단타({ throwMode: '자동' }).throwBase,
    )
  })

  it('수동이어도 사람이 송구 키를 누르면 그 루가 먼저다 — 0xb1c90 의 사람 가지(+0x160)', () => {
    const 눌렀다 = 만루단타({ throwMode: '수동', controls: 계속누름('수비', '6') })

    expect(눌렀다.throwBase).toBe(1)
    expect(눌렀다.log.some((line) => line.includes('사람이 1루로 송구 지시'))).toBe(true)
  })

  it('키 없는 수동은 송구가 없어 악송구 굴림(0xa1828)이 빠진다', () => {
    const 굴림수 = (mode: '수동' | '자동') => {
      let calls = 0
      let seed = 20100901
      const 하나 = () => {
        calls += 1
        seed = (seed * 1664525 + 1013904223) >>> 0
        return (seed >>> 8) / 0x1000000
      }
      const random: RandomPort = {
        next: 하나,
        nextInRange: (minimum, maximum) => minimum + 하나() * (maximum - minimum),
        pick: (candidates) => candidates[Math.floor(하나() * candidates.length)],
      }
      만루단타({ throwMode: mode, random })
      return calls
    }

    expect(굴림수('수동')).toBeLessThan(굴림수('자동'))
  })
})

describe('CPU 홈 송구 20% 특수 송구 — 0xafa60 → 0xb2c90 → 0xb3444 → 0xa1620', () => {
  // 만루 단타를 투수가 잡아 CPU 가 홈을 고르는 타구 (웹 근사 궤적 기준).
  // 0xafb24 후보표를 원본대로 +0x7c 칸으로 읽은 뒤로(throwTargetBase) 2루 주자 단타는 타자주자를 잡으러
  // 1루로 던진다 — 홈이 포스인 만루로 바꿨다.
  const 홈송구 = (value: number) =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory([90, 900, 350, 1]), // 원본 코드 3
      bases: { first: true, second: true, third: true },
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: 고정난수(value),
    })

  it('홈을 고르면 rand(0,100) ≤ 19 일 때 특수 송구다', () => {
    expect(홈송구(0.1).throwBase).toBe(0)
    expect(홈송구(0.1).log.some((line) => line.includes('0루로 특수 송구'))).toBe(true)
    expect(홈송구(0.5).log.some((line) => line.includes('특수'))).toBe(false)
  })

  it('내야수의 홈 송구는 맞혀도 효과가 없다 — 계획 [1] 은 외야수만 선다 (b368a)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(cpuSpecialThrowOf(야수, 5, 1).special).toBe(false)
    expect(cpuSpecialThrowOf(야수, 0, 1).special).toBe(false)
  })

  it('받을 야수가 없으면(+0xf0[홈] = −1) 던지지 않고 들고 뛴다 — 특수가 버려진다 (b2cc4)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(cpuSpecialThrowOf(야수, 8, -1).special).toBe(false)
  })

  it('외야수가 17틱 넘게 던지면 송구 속도가 +0xd8 = 130% 가 된다 (a16dc · 0xa0fc4)', () => {
    const 야수 = createFielders(Array.from({ length: 9 }, () => 500))
    expect(throwTicksToFielder(야수[8], 야수[1])).toBeGreaterThan(17)
    const 특수 = cpuSpecialThrowOf(야수, 8, 1)
    expect(특수.special).toBe(true)
    if (!특수.special) return
    expect(특수.thrower.throwSpeed).toBe(Math.trunc((야수[8].throwSpeed * 130) / 100))
    expect(throwTicksToFielder(특수.thrower, 야수[1])).toBeLessThan(throwTicksToFielder(야수[8], 야수[1]))
  })
})

describe('슬라이딩 효과음 10 — 사람 키 0x5199c · 자동 0x5268c', () => {
  const 땅볼1루: DefensePlayInput = {
    outcome: 땅볼아웃,
    // 원본 코드 3 — 투수가 바운드 뒤 6틱에 줍고 2루로 던진다. (예전 손-패턴 [113, 500, 300] 은 결과를 먼저 정하던
    // 다리 없이 돌리면 투수가 뜬 채로 잡는 공이다)
    trajectory: battedBallTrajectory([81, 897, 290, 1]),
    bases: 주자1루,
    outs: 0,
    runAbility: 500,
    throwMode: '자동',
  }
  const 소리틱 = (input: DefensePlayInput) => {
    let state = startDefensePlay(input)
    const ticks: number[] = []
    while (!isDefensePlayFinished(state)) {
      const tick = state.tick
      state = stepDefensePlay(state)
      if (state.slidingSoundThisTick) ticks.push(tick)
    }
    return { ticks, log: state.log }
  }

  it('송구가 향하는 루로 6틱 안에 닿는 주자는 키 없이 슬라이딩하고 그 틱에 소리가 난다 (0xb030c)', () => {
    const { ticks, log } = 소리틱(땅볼1루)
    const 자동 = log.filter((line) => line.includes('자동 슬라이딩'))
    expect(자동.length).toBeGreaterThan(0)
    expect(ticks).toEqual(자동.map((line) => Number.parseInt(line, 10)))
  })

  it('자동 슬라이딩은 슬라이딩 중인 주자를 다시 세지 않아 주자마다 한 번이다', () => {
    const { log } = 소리틱(땅볼1루)
    const 주자들 = log
      .filter((line) => line.includes('자동 슬라이딩'))
      .flatMap((line) => line.split('주자 ')[1].split('·'))
    expect(new Set(주자들).size).toBe(주자들.length)
  })
})

describe('송구 0xb2e38 — 중계 b4616 · AI 9 미루기 · 던진 야수 AI 0 · 내야 레이저 지우기 · 결과 코드 9', () => {
  it('외야수의 먼 송구는 중계맨이 받아 준비 틱(내야 3)이 지난 틱에 이어 던진다 (0xb3444 [0]·[4] · b4616)', () => {
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([134, 670, 1552, 0]), // 원본 코드 1 — 좌익수가 35틱에 뜬 채로 잡는다
      bases: EMPTY_BASES,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
    })
    const [첫, 둘] = 결과.log.filter((line) => line.includes('송구 —'))

    // 좌익수(7)가 2루로 — 거리 ≥ 17000 이라 유격수(5)가 중계한다. 첫 송구의 도착은 중계맨이 받는 틱이다
    expect(첫).toMatch(/^41틱 2루로 송구 — \d+틱 도착 \(5번 야수 중계\) \(CPU 결정\) \(7번 야수\)$/)
    const 받는틱 = Number(첫.split('— ')[1].split('틱')[0])
    expect(결과.throwArrivalTick).toBe(받는틱)
    // 쥐기 0xb2710 이 +0xc8 = 3 을 넣고, b4616 의 0xb2e38 은 vtC4 가 참이 되는 틱에 최종 받는 야수에게 던진다
    expect(둘).toMatch(new RegExp(`^${받는틱 + 3}틱 2루로 송구 — \\d+틱 도착 \\(중계 이어 던지기\\) \\(5번 야수\\)$`))
  })

  it('던진 야수는 커버·AI 9 가 아니면 AI 0 — 시작 자리 0xd86ec 로 걸어 돌아간다 (b2df8~b2e14 · b476a)', () => {
    const state = startDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([134, 670, 1552, 0]), // 원본 코드 1
      bases: EMPTY_BASES,
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
    })
    while (state.tick <= 41) stepDefensePlay(state)
    const 던진뒤 = state.fielders[7]
    expect(던진뒤.aiState).toBe(AI_STATE.IDLE)
    expect(던진뒤.target).toEqual(FIELDER_START_POSITIONS[7])
    const 거리 = (point: { x: number; z: number }) =>
      Math.hypot(point.x - FIELDER_START_POSITIONS[7].x, point.z - FIELDER_START_POSITIONS[7].z)
    const 전 = 거리(던진뒤.position)
    stepDefensePlay(state)
    expect(거리(state.fielders[7].position)).toBeLessThan(전)
  })

  describe('AI 9 — 받을 야수가 1구간 틱 안에 못 닿으면 미루고, 닿을 때가 되면 0xb2c90 으로 다시 보낸다', () => {
    // 3루 땅볼을 키 '6'(1루)으로 한 번 고르고, 포구 다음 틱에 1루수를 1루에서 6675 떨어진 곳으로 옮긴다
    const 미루기 = (z: number) => {
      let state = startDefensePlay({
        outcome: 땅볼아웃,
        // 원본 코드 3 — 3루수가 바운드 뒤에 줍는다 (예전 [120, 659, 333] 은 다리 없이 돌리면 3루수가 뜬 채로 잡는 공이다)
        trajectory: battedBallTrajectory([124, 907, 330, 1]),
        bases: EMPTY_BASES,
        outs: 0,
        controls: { side: '수비', keyAt: (tick) => (tick === 0 ? { key: '6', isRepeat: false } : null) },
      })
      const 기록: { tick: number; ai: number; target: { x: number; z: number } }[] = []
      while (!isDefensePlayFinished(state)) {
        if (state.tick === state.catchTick + 1) {
          state.fielders = state.fielders.map((fielder) =>
            fielder.slot === 2 ? { ...fielder, position: { x: 25_946, y: 0, z } } : fielder,
          )
        }
        state = stepDefensePlay(state, state.tick === 0 ? { key: '6', isRepeat: false } : null)
        const holder = state.fielders[4]
        기록.push({ tick: state.tick - 1, ai: holder.aiState, target: holder.target })
      }
      return { state, 기록 }
    }

    it('미룰 때 공 가진 야수는 AI 9 로 그 루를 향해 걷고(vt48), 놓아주는 틱에 던지고 AI 0 이 된다 (b30a2 · b4838 · b48ac)', () => {
      const { state, 기록 } = 미루기(20_500)
      expect(state.log).toContain('16틱 4번 야수가 1루 송구를 미룬다 — 2번 야수가 늦다 (AI 9)')
      const 송구 = state.log.find((line) => line.includes('(AI 9 미룬 송구)'))
      expect(송구).toMatch(/^17틱 1루로 송구 — \d+틱 도착 \(AI 9 미룬 송구\) \(4번 야수\)$/)
      const 미룬동안 = 기록.filter((entry) => entry.tick >= 16 && entry.tick < 17)
      expect(미룬동안.every((entry) => entry.ai === AI_STATE.RECEIVE)).toBe(true)
      expect(미룬동안[0]?.target).toEqual(basePosition(1))
      // b48ac 가 AI 0 으로 놓아준 뒤 — 송구의 vt34 가 받을 1루수를 +0x130 으로 세워 같은 틱 0xb1c90(6 절)이 3루 커버를 그에게 준다
      expect(기록.find((entry) => entry.tick === 17)?.ai).toBe(AI_STATE.COVER_THIRD)
    })

    it('받을 야수가 늦게 닿으면 그때까지 안 던진다 — AI 9 는 0xafa60 도 막고, 판 끝 세기(+0x120) 51틱 안에 닿으면 그때 던진다', () => {
      const { state } = 미루기(17_575)
      expect(state.log.some((line) => line.includes('미룬다'))).toBe(true)
      // 판 진행 관문 0xb0d28 은 공을 쥔 채 주자가 다 선 틱을 51틱 더 돌린다 — 그사이 1루수가 닿아 b4838 이 놓아준다
      const 송구들 = state.log.filter((line) => line.includes('송구 —'))
      expect(송구들).toEqual(['36틱 1루로 송구 — 43틱 도착 (AI 9 미룬 송구) (4번 야수)'])
    })
  })

  it('내야수 → 내야수 송구는 레이저 표시를 지운다 — 확정돼 있어도 보통 송구(악송구 굴림 포함)로 나간다 (b2ee6)', () => {
    let state = startDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      // 굴림 차례: 레이저(0, 확정) → 펌블(0.999, 실패) → 그 뒤 0 (투수가 줍는 대표 땅볼이라 필살수비는 안 굴린다)
      random: 차례난수([0, 0.999, 0]),
      controls: 계속누름('수비', '6'),
    })
    while (!isDefensePlayFinished(state)) state = stepDefensePlay(state, { key: '6', isRepeat: false })

    // 투수(0)가 1루수(2)에게 — 레이저는 확정됐지만 0xb2e38 이 +0x1f4 를 지운다
    expect(state.laserConfirmed).toBe(true)
    expect(state.laserThrow).toBe(false)
    expect(state.errantThrow).toBe(true)
    expect(state.log.some((line) => line.includes('레이저'))).toBe(false)
  })

  it('결과 코드 9 — 공 든 야수가 루에 막 닿았는데 주자가 서 있으면 0xbba 로 0xafa60 을 한 번 부른다 (b43ec~b444a)', () => {
    // 1아웃 1루 — 좌익수가 뜬 공을 잡아 2루로 던진 흔들린 긴 송구(a198c)를, 2루로 달려 들어온 2루수가 받는 그 틱에
    // 리터치한 1번 주자가 이미 2루에 서 있다. (예전 장면 — 코드 17 [65, 1012, 150] · 씨앗 5923 — 은 결과를 먼저 정하던
    // 다리 없이 돌리면 1루수 펌블 뒤 단타로 끝나 코드 9 가 안 선다)
    const 결과 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory([134, 944, 944, 0]), // 원본 코드 19
      bases: 주자1루,
      outs: 1,
      runAbility: 500,
      random: createSeededRandom(12),
      defenseIsCpu: true,
    })

    expect(결과.log).toContain('52틱 결과 코드 9 — 3번 야수가 2루에 닿았지만 1번 주자가 서 있다')
  })

  it('3아웃이면 그 틱 끝에서 판이 닫힌다 — 판 진행 관문 0xb0d28 의 state[6] > 2 (b0dbe)', () => {
    // 2아웃 2루 3루 땅볼 — 3루수가 1루로 던져 타자주자가 1루 포스(0xb36d0 결과 2)로 셋째 아웃이 된다
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([113, 1111, 100, 0]), // 원본 코드 3
      bases: { first: false, second: true, third: false },
      outs: 2,
      runAbility: 500,
      defenseIsCpu: true,
    })

    expect(결과.log).toContain('21틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
    // 다음 틱부터는 아무것도 안 돈다
    expect(결과.log.some((line) => line.startsWith('22틱'))).toBe(false)
    expect(결과.ticks).toHaveLength(22)
    expect(결과.advance.outsAdded).toBe(1)
    expect(결과.outcome).toEqual(땅볼아웃)
  })
})

describe('낙구 전에 아무도 못 닿는 타구 — 자르지 않은 예보(0xb12d0 · 0xb3b38 우선순위 6~8)', () => {
  /** 코드 15 패턴 — 내리꽂혀(플래그 비트0) 낙구 전에 아무도 못 닿는다 */
  const 일찍떨어지는공: BattedBallPattern = [90, 1040, 418, 1]

  it('바운드 뒤에 줍는 야수를 골라 판이 끝까지 가지 않는다 (예전엔 포구 틱 240)', () => {
    const trajectory = battedBallTrajectory(일찍떨어지는공)
    const result = play(뜬공아웃, 주자1루, 0, 일찍떨어지는공)
    expect(result.catchTick).toBeGreaterThan(trajectory.landingTick)
    expect(result.catchTick).toBeLessThan(40)
    expect(result.catchFielderSlot).toBe(3)
    // 뜬 채로 잡히지 않았다 — 원본에서 "잡힐 뜬공" 은 예보(vt94 = +0x11c ≤ 낙구 틱)가 정한다
    expect(result.caughtOnTheFly).toBe(false)
    // 2루수가 15틱에 주웠을 때는 늦어 CPU 송구 결정이 아무 데도 안 던진다 — 1루 주자는 바운드 포스로 2루, 타자주자는 1루 · 단타
    expect(result.advance.outsAdded).toBe(0)
    expect(result.advance.bases).toEqual({ first: true, second: true, third: false })
    expect(result.outcome).toEqual(단타)
    // 판 진행 관문 0xb0d28: 주자가 다 서고 공을 쥔 틱부터 +0x120 이 51틱을 세고 닫는다 (예전엔 240틱 끝까지 갔다)
    expect(result.ticks.length).toBeLessThan(100)
  })

  it('낙구 전에 잡히는 뜬공은 그대로 뜬공이다', () => {
    const pattern: BattedBallPattern = [129, 802, 500, 0]
    const result = play(뜬공아웃, 주자1루, 0, pattern)
    expect(result.caughtOnTheFly).toBe(true)
    expect(result.catchTick).toBeLessThanOrEqual(battedBallTrajectory(pattern).landingTick)
    expect(result.advance.bases).toEqual(주자1루)
  })
})

describe('판 진행 관문 0xb0d28 · 판 끝 결과 코드 0x9d5bc (b44f6) — playGate', () => {
  /** 원본 코드 18 [107, 879, 1211] — 바운드 뒤 담장 위로 넘는 공(결과 코드 10) */
  const 바운드넘김: BattedBallPattern = [107, 879, 1211, 0]
  /** 끝까지 돌리며 틱마다 상태를 적는다 */
  const 돌리기 = (input: DefensePlayInput) => {
    let state = startDefensePlay(input)
    const 세기: number[] = []
    const 주자: { tick: number; required: number[] }[] = []
    while (!isDefensePlayFinished(state)) {
      state = stepDefensePlay(state, null)
      세기.push(state.endCounter)
      주자.push({ tick: state.tick - 1, required: state.runners.map((runner) => runner.state.requiredBase) })
    }
    return { state, 세기, 주자 }
  }

  it('주자가 다 서고 공을 쥔 틱부터 +0x120 이 51틱을 세고, 52번째 관문에서 닫는다 (b0e46 `old > 50`)', () => {
    const { state, 세기 } = 돌리기({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(fixturePatternFor(땅볼아웃)),
      bases: EMPTY_BASES,
      outs: 0,
    })
    // 마지막 틱의 세기가 52(비교 전에 old + 1 을 적는다), 그 앞 51틱은 1 씩 올랐다
    expect(세기.at(-1)).toBe(52)
    const 시작 = 세기.lastIndexOf(1)
    expect(세기.slice(시작)).toEqual(Array.from({ length: 52 }, (_unused, index) => index + 1))
    expect(state.tick).toBe(시작 + 52)
  })

  it('공이 처음 땅에 닿는 틱에 결과 코드 6 을 내고 바운드 포스(0xa95e8)를 세운다 — 쥐기 전이다', () => {
    const trajectory = battedBallTrajectory(fixturePatternFor(땅볼아웃))
    const { state, 주자 } = 돌리기({ outcome: 땅볼아웃, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 6 (0x9d5bc)`)
    expect(state.catchTick).toBeGreaterThan(trajectory.landingTick)
    // 낙구 틱 끝에 1루 주자(목록 1번)의 요구 루가 2루로 선다
    expect(주자.find((entry) => entry.tick === trajectory.landingTick - 1)?.required[1]).toBe(-1)
    expect(주자.find((entry) => entry.tick === trajectory.landingTick)?.required[1]).toBe(2)
    expect(state.lastEventCode).toBe(6)
  })

  it('먼저 쥔 뜬공은 0x9d5bc 를 안 부른다 — 결과는 vt90 의 13 뿐 (b444e `+0x112 ≠ 0 → b4540`)', () => {
    const pattern: BattedBallPattern = [129, 802, 500, 0]
    const { state } = 돌리기({ outcome: 뜬공아웃, trajectory: battedBallTrajectory(pattern), bases: EMPTY_BASES, outs: 0 })
    expect(state.log.some((line) => line.includes('0x9d5bc'))).toBe(false)
    expect(state.ballContacted).toBe(true)
  })

  it('리터치 요구 루를 밟기 전에는 그 너머로 못 간다 (주자 틱 a028c) — 요구 루를 못 푼 채 송구로 잡히던 아웃이 없다', () => {
    // 2루 주자 · CPU 수비 · 깊은 중견수 뜬공: 예전엔 자동 진루가 리터치 틱에 3루로 보내 요구 루 2 가 남아 2루 송구로 죽었다
    const result = runDefensePlay({
      outcome: 뜬공아웃,
      trajectory: battedBallTrajectory([90, 810, 1592, 0]),
      bases: { first: false, second: true, third: false },
      outs: 0,
      runAbility: 500,
      defenseIsCpu: true,
      random: createSeededRandom(31),
    })
    expect(result.caughtOnTheFly).toBe(true)
    expect(result.advance.outsAdded).toBe(1)
    expect(result.log.some((line) => line.includes('루 아웃'))).toBe(false)
  })

  it('바운드 뒤 담장 위로 넘는 공은 낙구 틱에 결과 코드 10 — +0x124 · 종류 7(투구 때 루 + 2 까지 무조건 진루)', () => {
    const 홈 = { x: 20_000, y: 1_000, z: 30_000 }
    // 10틱에 떨어지고(높이 0) 20틱에 높이 2500 으로 담장선을 넘는 궤적 — 웹 궤적 근사에는 없는 모양이라 손으로 만든다.
    // 낙구 전에는 높이 6000 으로 날아 아무도 못 닿는다(예보 0xb12d0 은 자르지 않은 궤적 전체를 본다)
    const pointAt = (tick: number) => {
      const t = Math.max(0, Math.min(20, Math.trunc(tick)))
      const y = t === 10 ? 0 : t < 10 ? 6_000 : (t - 10) * 250
      return { x: 20_000, y, z: 홈.z - t * 1_300 }
    }
    const trajectory = {
      length: 21,
      pointAt,
      landingTick: 10,
      fenceTick: 20,
      poleTick: -1,
      startedAtPlate: true,
    }
    let state = startDefensePlay({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    while (state.tick <= 10) state = stepDefensePlay(state, null)
    expect(state.log).toContain('10틱 낙구 — 판 끝 결과 코드 10 (0x9d5bc)')
    expect(state.groundRuleFlag).toBe(true)
    expect(state.play.kind).toBe(7)
    expect(state.lastEventCode).toBe(10)
  })

  it('담장 면(높이 ≤ 1999)에 맞은 공은 담장선 틱(aa4)이 아니라 aa8 이다 — 낙구 틱의 결과 코드 6', () => {
    // 원본 코드 15 [100, 1000, 700]: 17틱에 떨어져 굴러가 36틱에 가운데 담장 면에 맞는다(0xa2cae) — 담장선(aa4)은 없다.
    // (예전 원본 코드 0 [90, 810, 1592] 는 담장 면에 맞고 떨어지는 공이지만 중견수가 낙구 틱에 뜬 채로 잡는다)
    const pattern: BattedBallPattern = [100, 1000, 700, 0]
    const trajectory = battedBallTrajectory(pattern)
    expect(trajectory.fenceTick).toBe(-1)
    expect(trajectory.wallTick).toBe(36)
    const { state } = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 6 (0x9d5bc)`)
    expect(state.play.kind).toBe(1)
  })

  it('바운드 뒤 담장 위로 넘는 원본 궤적 — 낙구 틱에 0x9d5bc 가 미리 깐 aa4(state[0x20])를 보고 코드 10 (511ea · b44f6)', () => {
    // 원본 코드 18 [107, 879, 1211]: 바운드한 뒤 담장 위로 넘는다 — 원본 표에서 아무도 낙구 전에 못 닿는 단 하나의 그런 공.
    // (예전 원본 코드 0 [92, 781, 1313] 은 중견수가 낙구 틱에 뜬 채로 잡는다)
    const trajectory = battedBallTrajectory(바운드넘김)
    expect(trajectory.fenceTick).toBeGreaterThan(trajectory.landingTick)
    const { state } = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0 })
    expect(state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 10 (0x9d5bc)`)
    expect(state.groundRuleFlag).toBe(true)
  })

  it('무조건 진루 갈래(+0x111 · +0x129 · 종류 7 — af964 · af970 · af97a)는 타자주자도 결과 코드 루 너머로 보낸다', () => {
    // 원본 코드 24 [7] [98, 995, 1369]: 속도 < 1100 이라 웹 타석 결과는 2루타지만 29틱에 담장 위로 넘는다(코드 8)
    const 홈런공 = battedBallTrajectory(BATTED_BALL_PATTERNS[24][7])
    expect(홈런공.fenceTick).toBe(29)
    expect(홈런공.landingTick).toBe(32)
    const 홈런 = 돌리기({ outcome: 이루타, trajectory: 홈런공, bases: 주자1루, outs: 0 })
    expect(홈런.state.homeRunFlag).toBe(true)
    // 타자주자까지 홈을 밟아 0xa990c == 0 — 관문 b0e04 가 닫는다(예전엔 타자주자가 2루에 선 채 240틱까지 갔다)
    expect(홈런.state.runners.every((runner) => runner.state.scored)).toBe(true)
    expect(홈런.state.held.scoreboardRuns).toBe(2)
    expect(홈런.state.ticks.length).toBeLessThan(240)
    // 바운드 뒤 담장을 넘는 코드 10(종류 7)은 투구 때 루 + 2 까지 — 단타 결과의 타자주자도 2루까지 간다
    const 바운드 = 돌리기({ outcome: 단타, trajectory: battedBallTrajectory(바운드넘김), bases: EMPTY_BASES, outs: 0 })
    expect(바운드.state.play.kind).toBe(7)
    expect(바운드.state.runners[0].state.startBase).toBe(2)
  })

  it('state[0x19](투구 판정 0.1% 사건)가 서면 낙구 틱의 0x9d5bc 가 0 — 사건 코드가 안 난다 (9d5ce)', () => {
    const trajectory = battedBallTrajectory(바운드넘김)
    const 사건 = 돌리기({ outcome: 단타, trajectory, bases: 주자1루, outs: 0, specialEvent: true })
    expect(사건.state.log).toContain(`${trajectory.landingTick}틱 낙구 — 판 끝 결과 코드 0 (0x9d5bc)`)
    expect(사건.state.groundRuleFlag).toBe(false)
    expect(사건.state.lastEventCode).not.toBe(10)
  })

  it('폴 충돌 굴림 rand(−25, 25)(0xa2c64)는 판 시작에서 필살수비 굴림 뒤에 난수로 다시 깐다 — 굴림이 없던 궤적은 그대로', () => {
    // 원본 코드 24 [45, 1402, 991]: 20틱에 1루 쪽 폴 — 새 각 = 149 + rand(−25, 25)
    const 폴 = battedBallTrajectory([45, 1402, 991, 0])
    const 굴림 = startDefensePlay({ outcome: 단타, trajectory: 폴, bases: EMPTY_BASES, outs: 0, random: 고정난수(0) })
    expect(굴림.trajectory).not.toBe(폴)
    expect(굴림.trajectory.pointDetailAt?.(20).angle).toBe(149 - 25)
    const 그대로 = startDefensePlay({ outcome: 단타, trajectory: 폴, bases: EMPTY_BASES, outs: 0 })
    expect(그대로.trajectory).toBe(폴)
    expect(그대로.trajectory.pointDetailAt?.(20).angle).toBe(149)
  })

  it('협살이 풀린 틱에 날아가던 짝 송구도 짝이 받는다 — 공을 아무도 안 쥔 채 240틱까지 가지 않는다', () => {
    const result = runDefensePlay({
      outcome: 이루타,
      // 원본 코드 0 — 중견수가 잡은 뒤 리터치한 1루 주자가 1·2루 사이에서 협살에 걸린다
      // (예전 [92, 174, 897] 은 결과를 먼저 정하던 다리 없이 돌리면 투수가 뜬 채로 잡아 협살이 안 선다)
      trajectory: battedBallTrajectory([92, 955, 1159, 0]),
      bases: 주자1루,
      outs: 1,
      runAbility: 500,
      defenseIsCpu: true,
      random: createSeededRandom(173),
    })
    expect(result.rundowns).toBeGreaterThan(0)
    expect(result.ticks.length).toBeLessThan(240)
  })
})

describe('포구 틱 b4292 — 발밑 루에 주자가 서 있는 포구는 결과 코드 9 (쥐기 b42c8 앞)', () => {
  it('2루 위에서 송구를 받는 틱에 2루에 마지막으로 닿은 주자가 서 있으면 9 — 타구 포구뿐 아니라 송구 받기에도 걸린다', () => {
    // 원본 코드 0 [90, 810, 1592]: 중견수 뜬공 아웃 뒤 2루 위의 3번 야수가 송구를 받는다
    const result = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory([90, 810, 1592, 0]),
      bases: 주자1루,
      outs: 1,
      defenseIsCpu: true,
      throwMode: '자동',
      random: createSeededRandom(4),
    })
    expect(result.log).toContain('64틱 결과 코드 9 — 3번 야수가 2루 위에서 잡았지만 1번 주자가 서 있다 (b4292)')
    // 9 를 내는 틱에도 쥐기는 그대로 돈다(b42c8)
    expect(result.log).toContain('64틱 3번 야수가 잡았다 (종류 0)')
  })
})
