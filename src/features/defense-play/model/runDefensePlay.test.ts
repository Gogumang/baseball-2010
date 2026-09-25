import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { AUTO_ADVANCE_TICK_MARGIN, beatsThrow } from '@/entities/fielding/model/autoAdvance'
import { BASE_POSITIONS, FIELDER_COUNT } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'
import {
  defenseAbilitiesOf,
  isBattedBallInPlay,
  runDefensePlay,
} from '@/features/defense-play/model/runDefensePlay'
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
): DefensePlayResult {
  return runDefensePlay({
    outcome,
    trajectory: battedBallTrajectory(representativePatternOf(outcome)),
    bases,
    outs,
    runAbility: 500,
    runningMode,
    throwMode: '자동',
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

  /**
   * 원본 `state[0x87]` — 아웃 콜 62/20 을 가르는 칸(0x51b44). "한 번이라도" 가 아니라
   * **마지막 아웃 판정이 태그였나** 다 (0xb36d0 이 부를 때마다 0 으로 지우고 시작한다).
   */
  it('tagOut = 마지막 아웃 판정이 태그였나 (state[0x87])', () => {
    // 아웃 판정이 한 번도 태그를 내지 않는 평범한 땅볼·뜬공은 서지 않는다
    expect(play(땅볼아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(뜬공아웃, EMPTY_BASES, 0).tagOut).toBe(false)
    expect(play(단타, 만루, 0).tagOut).toBe(false)
    // 만루 땅볼은 3번 주자가 태그로 잡힌다 (진행 기록 참고)
    const 만루땅볼 = play(땅볼아웃, 만루, 0)
    expect(만루땅볼.tagOut).toBe(true)
    expect(만루땅볼.log.some((줄) => 줄.includes('태그 아웃'))).toBe(true)
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
    // 굴림 순서대로 값을 먹인다: 필살수비 A → B → **레이저** → 펌블 → 악송구.
    // 앞 넷은 실패(0.9), 마지막만 성공(0) 시켜 **악송구만** 떼어 본다.
    //
    // ⚠️ 레이저 굴림(0x66a8c)이 셋째 자리에 있는 것은 **원본 그대로**다 — 0x523bc 는 사람·CPU 를
    // 가리지 않고 돌고(수비 주체 갈림은 0x52468 의 굴림 **뒤**), 창이 열리는 첫 틱(포구 10틱 전)이
    // 펌블 굴림(포구 틱, 0xb41d0)보다 앞선다. 예전에는 사람 수비일 때만 굴려 이 자리가 비어 있었다.
    const 결과 = runDefensePlay({
      outcome: 땅볼아웃,
      trajectory: battedBallTrajectory(representativePatternOf(땅볼아웃)),
      bases: 주자1루,
      outs: 0,
      random: 차례난수([0.9, 0.9, 0.9, 0.9, 0, 0.9]),
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
  const 협살상황 = (defenseIsCpu: boolean) =>
    runDefensePlay({
      outcome: 단타,
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
      bases: 주자1루,
      outs: 0,
      defenseIsCpu,
    })

  it('수비가 CPU 일 때만 걸린다 — 사람이 수비하면 원본에서도 안 일어난다 (state[0x31+수비측])', () => {
    expect(협살상황(true).log.some((line) => line.includes('협살 시작'))).toBe(true)
    expect(협살상황(false).log.some((line) => line.includes('협살 시작'))).toBe(false)
  })

  it('안 주면 안 돈다 — 부르는 쪽이 말해 주지 않으면 시작하지 않는다', () => {
    const 기본 = play(단타, 주자1루, 0)

    expect(기본.rundowns).toBe(0)
    expect(기본.log.some((line) => line.includes('협살'))).toBe(false)
  })

  it('송구가 닿으면 공은 받은 야수의 손으로 옮겨 간다 — 그래야 협살 조건이 선다 (0xb2734)', () => {
    const 결과 = 협살상황(true)
    const 시작 = 결과.log.find((line) => line.includes('협살 시작'))

    expect(결과.rundowns).toBe(1)
    // 2루로 간 송구를 받은 유격수(5)와 3루수(4)가 1번 주자를 사이에 둔다
    expect(시작).toContain('1번 주자')
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
    const 결과 = runDefensePlay({
      outcome: 이루타,
      trajectory: battedBallTrajectory(representativePatternOf(이루타)),
      bases: { first: true, second: true, third: false },
      outs: 0,
      defenseIsCpu: true,
      controls: { side: '공격', keyAt: (tick) => (tick === 33 ? { key: '3' } : null) },
    })

    expect(결과.log.some((line) => line.includes('귀루'))).toBe(true)
    expect(결과.rundowns).toBe(0)
    expect(결과.rundownOuts).toBe(0)
    expect(결과.log.some((line) => line.includes('태그 아웃 (0xb36d0 결과 3)'))).toBe(true)
  })

  it('타자주자는 협살 대상이 아니다 — 타자주자의 운명은 결과 코드가 정한다 (근사)', () => {
    // 3루타는 타자주자가 반드시 3루까지 간다. 협살이 그를 잡으면 기록과 어긋난다
    const 결과 = runDefensePlay({
      outcome: 삼루타,
      trajectory: battedBallTrajectory(representativePatternOf(삼루타)),
      bases: EMPTY_BASES,
      outs: 0,
      defenseIsCpu: true,
    })

    expect(결과.advance.outsAdded).toBe(0)
    expect(결과.advance.bases).toEqual({ first: false, second: false, third: true })
    expect(결과.rundowns).toBe(0)
  })
})

describe('화면 스냅샷 배선 — 번쩍임 · 마선수 그림 · 팀 팔레트 (R2 2절 · C-16 · C-1)', () => {
  /** 필살 슬라이딩 캐치가 골라지는 원본 패턴 (코드 0, 뜬공아웃) — 창이 열려야 골라진다 */
  const 슬라이딩캐치패턴: BattedBallPattern = [92, 955, 1159, 0]
  /** 필살 점프 캐치가 골라지는 원본 패턴 (코드 1, 뜬공아웃) */
  const 점프캐치패턴: BattedBallPattern = [126, 1021, 963, 0]

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
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
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
      trajectory: battedBallTrajectory(representativePatternOf(땅볼아웃)),
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
    trajectory: battedBallTrajectory(representativePatternOf(단타)),
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

    expect(뽑은수({ defenseIsCpu: true })).toBe(뽑은수({ defenseIsCpu: false }))
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

describe('포스 사슬 — 결과 코드가 준 최소 루가 앞 주자까지 민다 (`createPlayRunners`)', () => {
  // 한 줄 규칙: **최소 진루 루 = min(홈, max(출발 루, 타자주자 최소 루 + 목록 번호))**.
  //
  // 왜 자동 진루(0xaf918)가 아니라 여기인가 — 원본에는 "이 타구는 2루타" 라는 결과 코드가 없다.
  // 타자주자가 2루까지 가면 그게 2루타다. 그래서 원본의 포스 사슬 머리는 늘 "타자주자 → 1루" 고,
  // 원본은 **한 루에 산 주자를 둘 놓지 않는다**("루 b 의 주자" 0xa97a0 이 +0x8c == b 인 주자를
  // 하나만 집어 온다 · 주루 키의 앞길/뒷길 검사 0xa99a8 · 0xa9924, I 3b).
  // 웹판은 결과 코드가 먼저 정하니 사슬 머리가 그 최소 루가 되어야 아귀가 맞는다.
  const 진루 = (bases: BaseState) => [bases.first, bases.second, bases.third]

  it('2루타 + 1루 주자: 수동이어도 1루 주자가 3루까지 밀린다 — 포스는 자동 제어기가 아니다', () => {
    const 수동 = play2(이루타, 주자1루, 0, '수동')

    // 예전에는 1루 주자가 타자주자와 함께 2루에 서 버려 `basesOf` 가 하나를 지웠다(증발).
    expect(수동.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(수동.advance.runsScored).toBe(0)
    expect(수동.advance.outsAdded).toBe(0)
  })

  it('2루타 + 1루 주자: 자동과 수동이 같은 자리에 선다 — 포스가 모드에 안 흔들린다', () => {
    expect(play2(이루타, 주자1루, 0, '수동').advance).toEqual(
      play2(이루타, 주자1루, 0, '자동').advance,
    )
  })

  it('3루타 + 1루 주자: 1루 주자는 홈까지 밀려 득점한다', () => {
    const 수동 = play2(삼루타, 주자1루, 0, '수동')

    expect(수동.advance.bases).toEqual({ first: false, second: false, third: true })
    expect(수동.advance.runsScored).toBe(1)
  })

  it('2루타 + 만루: 두 명이 밀려 들어온다', () => {
    const 수동 = play2(이루타, 만루, 0, '수동')

    expect(수동.advance.bases).toEqual({ first: false, second: true, third: true })
    expect(수동.advance.runsScored).toBe(2)
  })

  it('3루타 + 만루: 사슬이 홈에서 멈춰 세 명이 다 들어온다', () => {
    const 수동 = play2(삼루타, 만루, 0, '수동')

    expect(수동.advance.bases).toEqual({ first: false, second: false, third: true })
    expect(수동.advance.runsScored).toBe(3)
  })

  it('빈 루는 사슬을 끊는다 — 2루타 + 3루 주자뿐이면 3루 주자는 안 밀린다', () => {
    const 수동 = play2(이루타, 주자3루, 0, '수동')

    // 타자주자는 2루, 3루 주자는 포스가 아니니 수동에서는 제자리다 (자동 진루가 안 돈다)
    expect(진루(수동.advance.bases)).toEqual([false, true, true])
    expect(수동.advance.runsScored).toBe(0)
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
      trajectory: battedBallTrajectory(representativePatternOf(단타)),
      bases: 만루,
      outs: 0,
      runAbility: 500,
      ...extra,
    })

  it('안 넘기면 원본 기본값(수동)이다 — 설정 +0xf4 의 생성자 값이 0 이다', () => {
    expect(송구줄(만루단타())).toBe(송구줄(만루단타({ throwMode: '수동' })))
  })

  it('수동이면 점수식 0xafb24 가 안 돌고 0xb1c90 이 앞선 주자의 루를 고른다', () => {
    // 만루 단타 — 3루 주자가 홈(웹 루 번호 4 = 원본 표 0xd86b0 의 홈 사본)으로 간다
    expect(만루단타({ throwMode: '수동' }).throwBase).toBe(4)
    // 자동이면 점수식이 더 가까운 루를 고른다
    expect(만루단타({ throwMode: '자동' }).throwBase).toBe(2)
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

  it('난수 굴림 차례는 수동/자동에 한 톨도 안 흔들린다', () => {
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

    expect(굴림수('수동')).toBe(굴림수('자동'))
  })
})
