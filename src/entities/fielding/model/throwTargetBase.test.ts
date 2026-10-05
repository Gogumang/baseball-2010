import { describe, expect, it } from 'vitest'
import { BASE_SCORE, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import {
  chooseThrowTargetBase,
  describeThrowTarget,
  HOME_SPECIAL_THROW_PERCENT,
  isForcedRunner,
  isSpecialThrow,
  type ThrowTargetInput,
} from '@/entities/fielding/model/throwTargetBase'

const 주력500 = runnerSpeedOf(500)
const 기본야수 = createFielders(Array.from({ length: 9 }, () => 500))
/** 유격수(5)가 공을 쥐고 있다 */
const 유격수보유 = 기본야수.map((fielder, slot) =>
  slot === 5 ? { ...fielder, holdingBall: true } : fielder,
)

const 입력 = (
  play: Partial<PlayView>,
  runners: readonly RunnerState[],
  overrides: Partial<ThrowTargetInput> = {},
): ThrowTargetInput => ({
  play: { ...initialPlayView(1), ...play },
  fielders: 유격수보유,
  runners,
  currentTick: 0,
  landingTick: 30,
  difficulty: 0,
  activeRunnerCount: runners.length,
  ...overrides,
})

const 타자주자 = createRunner(0, 0, 주력500, { targetBase: 1 })
/** 홈으로 가는 3루 주자 — 원본 +0x7c 는 4 다(0xb6228 · 0xa07b0) */
const 삼루주자 = createRunner(1, 3, 주력500, { targetBase: 4 })
const 만루플레이: Partial<PlayView> = {
  coverOfBase: [1, 2, 3, 4],
  ballHolderSlot: 5,
  catchFielderSlot: 5,
  everHeld: true,
  held: true,
}

describe('안 던지는 두 경우 (0xafb7e · 0xb02e4)', () => {
  it('주자가 없고 내야수가 잡았으면 −1', () => {
    expect(
      chooseThrowTargetBase(
        입력({ ballHolderSlot: 3, catchFielderSlot: 3 }, [], { activeRunnerCount: 0 }),
      ),
    ).toBe(NONE)
  })

  it('주자가 없어도 외야수가 잡았으면 −1 대신 2루로 던진다', () => {
    expect(
      chooseThrowTargetBase(
        입력({ ballHolderSlot: 8, catchFielderSlot: 8 }, [], { activeRunnerCount: 0 }),
      ),
    ).toBe(2)
  })

  it('어떤 루도 점수를 못 얻었고 내야수가 잡았으면 −1', () => {
    expect(
      chooseThrowTargetBase(
        입력({ ballHolderSlot: 3, catchFielderSlot: 3 }, [], { activeRunnerCount: 1 }),
      ),
    ).toBe(NONE)
  })
})

describe('플레이 vt 0x80 = 0xb1b54 — 포스로 밀려 가는 주자인가', () => {
  const play = { ...initialPlayView(1), everHeld: true }

  it('타자주자는 늘 1 이다', () => {
    expect(isForcedRunner(play, [타자주자], 0)).toBe(true)
  })

  it('아직 공이 한 번도 안 잡혔으면 0 이다', () => {
    expect(isForcedRunner(initialPlayView(1), [타자주자, 삼루주자], 1)).toBe(false)
  })

  it('내가 닿은 루(+0x8c)가 바로 앞 주자가 달려가는 루(+0x7c)면 1 이다 (b1b72)', () => {
    const 일루주자 = createRunner(1, 1, 주력500, { targetBase: 2 })
    expect(isForcedRunner(play, [타자주자, 일루주자], 1)).toBe(true)
    // 3루 주자는 타자주자가 1루로 가도 밀리지 않는다
    expect(isForcedRunner(play, [타자주자, 삼루주자], 1)).toBe(false)
  })
})

describe('점수식 0xafb24 — 후보표와 최종 점수 (난이도 0 = 점수식)', () => {
  const 상황 = 입력(만루플레이, [타자주자, 삼루주자])
  const 결과 = describeThrowTarget(상황)

  it('후보표: 주자 도착 틱은 "그 주자가 달려가는 루(+0x7c)" 칸에 들어간다 (0xafbae)', () => {
    // 타자주자 → 1루 칸, 홈으로 가는 3루 주자(+0x7c = 4) → 4 & 3 = 홈 칸
    expect(결과.candidates.map((candidate) => candidate.runTick)).toEqual([23, 23, NONE, NONE])
    expect(결과.candidates.map((candidate) => candidate.defTick)).toEqual([16, 12, 9, 7])
    // forced(vt0x80)도 +0x7c 칸에 — 타자주자(늘 1)의 1루만 선다
    expect(결과.candidates.map((candidate) => candidate.forced)).toEqual([false, true, false, false])
  })

  it('여유 = 주자 틱 − 수비 틱, 확실한 아웃 후보(포스 = 타자주자의 1루)에만 적힌다', () => {
    expect(결과.margins).toEqual([NONE, 11, NONE, NONE])
  })

  it('루 기본 점수는 표 0xd85ac 대로 홈이 가장 크다', () => {
    expect(BASE_SCORE).toEqual([4000, 1000, 2000, 3000])
  })

  it('불확실한 홈 보너스 1000000 — 난이도 0 의 점수식은 밀리지 않는 3루 주자라도 홈을 고른다', () => {
    // 홈 = 4000 + 1000000(A) + 2×10000 + 500(B) = 1024500 — 둘째 루 항은 확실(effective)한 첫 루에만 붙는다
    // 1루 = 1000(A) + 2×(100011 + 5001(밖·1루) + 10000(달리는 중)) + 500(B) = 231524
    // 후보가 없는 루도 바닥값 500 은 받는다 (`+500`)
    expect(결과.topScores).toEqual([1_024_500, 231_524, 500, 500])
    expect(결과.chosen).toBe(0)
  })

  it('난이도 0~1 에서는 점수식, 2 이상에서는 "여유 최대" 규칙으로 바뀐다', () => {
    expect(describeThrowTarget({ ...상황, difficulty: 1 }).sure).toBe(false)
    expect(describeThrowTarget({ ...상황, difficulty: 2 }).sure).toBe(true)
    expect(describeThrowTarget({ ...상황, difficulty: 3 }).sure).toBe(true)
  })

  it('"여유 최대" 규칙은 여유가 가장 큰 루를 고른다', () => {
    const 어려움 = describeThrowTarget({ ...상황, difficulty: 3 })
    const 최대 = 어려움.margins.indexOf(Math.max(...어려움.margins))
    expect(어려움.chosen).toBe(최대)
    expect(어려움.chosen).toBe(1)
  })

  it('난이도가 3 이상이면 확실한 후보가 없어도 늘 "여유 최대" 로 간다', () => {
    const 후보없음 = describeThrowTarget(
      입력({ ballHolderSlot: 3, catchFielderSlot: 3 }, [], { activeRunnerCount: 1, difficulty: 3 }),
    )
    expect(후보없음.sure).toBe(true)
  })
})

describe('도루 주자 — 떠난 루가 아니라 달려가는 루로 던진다', () => {
  it('1루 → 2루 도루 주자는 2루 칸에 들어가 포수가 2루를 고른다 (예전 웹은 1루 칸)', () => {
    const 포수보유 = 기본야수.map((fielder, slot) => (slot === 1 ? { ...fielder, holdingBall: true } : fielder))
    const 도루주자 = createRunner(1, 1, 주력500, { targetBase: 2 })
    const 결과 = describeThrowTarget(
      입력(
        { ...initialPlayView(5), coverOfBase: [1, 2, 3, 4], ballHolderSlot: 1, catchFielderSlot: 1, everHeld: true, held: true },
        [도루주자],
        { fielders: 포수보유, landingTick: 0, difficulty: 2 },
      ),
    )
    expect(결과.candidates.map((candidate) => candidate.runTick)).toEqual([NONE, NONE, 23, NONE])
    expect(결과.margins).toEqual([NONE, NONE, 8, NONE])
    expect(결과.chosen).toBe(2)
  })
})

describe('1루 커버가 없을 때의 예외 (2-6)', () => {
  const 선위야수: readonly FielderState[] = 기본야수.map((fielder, slot) =>
    slot === 3 ? { ...fielder, holdingBall: true, position: { x: 22_973, y: 0, z: 26_810 } } : fielder,
  )
  const 느린타자주자 = createRunner(0, 0, runnerSpeedOf(0), { targetBase: 1 })

  it('1루선에서 499 이내에 있고 타자주자보다 빠르면 수비 틱 = 주자 틱 으로 적는다', () => {
    const 결과 = describeThrowTarget(
      입력({ ballHolderSlot: 3, catchFielderSlot: 3, everHeld: true, held: true }, [느린타자주자], {
        fielders: 선위야수,
      }),
    )
    expect(결과.candidates[1].defTick).toBe(결과.candidates[1].runTick)
  })

  it('1루선에서 멀면 예외가 안 걸린다', () => {
    const 먼야수 = 기본야수.map((fielder, slot) =>
      slot === 3 ? { ...fielder, holdingBall: true } : fielder,
    )
    const 결과 = describeThrowTarget(
      입력({ ballHolderSlot: 3, catchFielderSlot: 3, everHeld: true, held: true }, [느린타자주자], {
        fielders: 먼야수,
      }),
    )
    expect(결과.candidates[1].defTick).not.toBe(결과.candidates[1].runTick)
  })
})

describe('CPU 송구 결정 0xafa60 — 홈 송구는 20% 로 특수 송구', () => {
  it('홈일 때만, 굴림이 20 미만일 때만 특수다', () => {
    expect(HOME_SPECIAL_THROW_PERCENT).toBe(20)
    expect(isSpecialThrow(0, 19)).toBe(true)
    expect(isSpecialThrow(0, 20)).toBe(false)
    expect(isSpecialThrow(3, 0)).toBe(false)
  })
})
