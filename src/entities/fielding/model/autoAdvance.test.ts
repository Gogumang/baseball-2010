import { describe, expect, it } from 'vitest'
import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  autoAdvanceDecisions,
  AUTO_ADVANCE_TICK_MARGIN,
  beatsThrow,
  clearsRequirement,
  requiredBasesOnBounce,
  requiredBasesOnFlyCatch,
  TAG_DISTANCE,
  type AutoAdvanceInput,
} from '@/entities/fielding/model/autoAdvance'
import {
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
const 주력500 = runnerSpeedOf(500)

/** 3루수와 포수가 좌중간 깊이 끌려 나간 상태 — 수비 도착이 늦어 자동 진루가 걸린다 */
const 끌려나간수비 = 야수들.map((fielder, slot) => {
  if (slot === 4) return { ...fielder, position: { x: 14_664, y: 0, z: 5_000 } }
  if (slot === 1) return { ...fielder, position: { x: 20_000, y: 0, z: 5_000 } }
  return fielder
})

const 문맥 = (
  play: Partial<PlayView>,
  runners: readonly RunnerState[],
  overrides: Partial<AutoAdvanceInput> = {},
): AutoAdvanceInput => ({
  play: { ...initialPlayView(1), ...play },
  fielders: 야수들,
  runners,
  currentTick: 0,
  landingTick: 30,
  ...overrides,
})

describe('자동 추가 진루 0xaf918 — "수비보다 2틱 이상 빠를 때만"', () => {
  it('판정표 (t_def − 1 > t_run)', () => {
    const 표: readonly [number, number, boolean][] = [
      // [주자 틱, 수비 틱, 가는가]
      [20, 20, false],
      [20, 21, false], // 딱 1틱 빨라도 안 간다
      [20, 22, true], // 2틱 빠르면 간다
      [20, 30, true],
      [20, 19, false],
    ]
    표.forEach(([run, defense, goes]) => expect(beatsThrow(run, defense)).toBe(goes))
    expect(AUTO_ADVANCE_TICK_MARGIN).toBe(2)
  })

  it('수비가 한참 늦으면 앞선 주자부터 한 루씩 더 간다', () => {
    // 2루로 달리는 주자. 3루수가 좌중간 깊이 끌려 나가 있어 3루 도착이 78틱 이나 된다
    const 주자 = createRunner(1, 1, 주력500, { targetBase: 2 })
    const 결정 = autoAdvanceDecisions(
      문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [주자], { fielders: 끌려나간수비 }),
    )
    expect(결정).toEqual([{ runnerIndex: 1, toBase: 3 }])
  })

  it('수비가 빠르면 안 간다 — 포수는 늘 홈에 붙어 있다', () => {
    const 주자 = createRunner(1, 2, 주력500, { targetBase: 3 })
    expect(autoAdvanceDecisions(문맥({ ballHolderSlot: 4, catchFielderSlot: 4 }, [주자]))).toEqual([])
  })

  it('**잡힐 뜬공이면 아무도 안 뛴다** — 원본에 희생플라이 보장이 없는 이유', () => {
    const 주자 = createRunner(1, 1, 주력500, { targetBase: 2 })
    const 문 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8, earliestCatchTick: 20 }, [주자], {
      fielders: 끌려나간수비,
    })
    expect(autoAdvanceDecisions(문)).toEqual([])
    // 잡히고 나면(태그업 뒤) 다시 판단한다
    expect(autoAdvanceDecisions({ ...문, play: { ...문.play, everHeld: true } })).toEqual([
      { runnerIndex: 1, toBase: 3 },
    ])
  })

  it('플레이 종류 2·3(볼넷)·8 은 아예 보지 않는다', () => {
    const 주자 = createRunner(1, 2, 주력500, { targetBase: 2 })
    for (const kind of [2, 3, 8]) {
      expect(autoAdvanceDecisions(문맥({ kind, ballHolderSlot: 8, catchFielderSlot: 8 }, [주자]))).toEqual([])
    }
  })

  it('플레이가 끝났거나 +0x12a 가 서 있으면 안 본다', () => {
    const 주자 = createRunner(1, 2, 주력500, { targetBase: 2 })
    expect(
      autoAdvanceDecisions(문맥({ ballHolderSlot: 8, catchFielderSlot: 8, finished: true }, [주자])),
    ).toEqual([])
    expect(
      autoAdvanceDecisions(문맥({ ballHolderSlot: 8, catchFielderSlot: 8, suppressed: true }, [주자])),
    ).toEqual([])
  })

  it('멈춘 주자는 force 일 때만 본다', () => {
    const 멈춤 = createRunner(1, 2, 주력500, { targetBase: 2 }) // 위치 == 목표 루
    const 문 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [멈춤], { fielders: 끌려나간수비 })
    expect(autoAdvanceDecisions(문)).toEqual([])
    expect(autoAdvanceDecisions({ ...문, force: true })).toEqual([{ runnerIndex: 1, toBase: 3 }])
  })

  it('앞길이 막혀 있으면 안 간다 (0xa9924)', () => {
    const 뒤 = createRunner(1, 1, 주력500, { targetBase: 2 })
    const 앞 = createRunner(2, 2, 주력500, { targetBase: 3 })
    const 문 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [뒤, 앞], { fielders: 끌려나간수비 })
    // 앞 주자가 3루를 목표로 하고 있으니 뒤 주자는 3루로 못 간다
    expect(autoAdvanceDecisions(문).map((decision) => decision.runnerIndex)).toEqual([2])
    // 앞길 검사를 갈아 끼우면 둘 다 막힌다
    expect(autoAdvanceDecisions({ ...문, isPathClear: () => false })).toEqual([])
  })

  it('플레이 종류 7 은 틱을 안 보고 바로 간다 (출발루+2 까지만)', () => {
    const 주자 = createRunner(1, 0, 주력500, { targetBase: 1 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [주자]))).toEqual([{ runnerIndex: 1, toBase: 2 }])
    const 이미 = createRunner(1, 0, 주력500, { targetBase: 2 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [이미]))).toEqual([])
  })
})

describe('포스와 태그업 — 요구 루 세우기', () => {
  it('공이 땅에 닿으면 포스: 목표 루 ≤ 주자 번호면 요구 루 = 투구 때 루 + 1 (0xa95e8)', () => {
    const 주자들 = [
      createRunner(0, 0, 주력500, { targetBase: 1, pitchBase: 0 }),
      createRunner(1, 1, 주력500, { targetBase: 1, pitchBase: 1 }),
      createRunner(2, 2, 주력500, { targetBase: 3, pitchBase: 2 }),
    ]
    expect(requiredBasesOnBounce(주자들)).toEqual([NONE, 2, NONE])
  })

  it('뜬공을 잡으면 모두 원래 루로 돌아가 밟아야 한다 (0xa9620 태그업)', () => {
    const 주자들 = [
      createRunner(0, 0, 주력500, { targetBase: 1, pitchBase: 0 }),
      createRunner(1, 2, 주력500, { targetBase: 3, pitchBase: 2 }),
    ]
    expect(requiredBasesOnFlyCatch(주자들)).toEqual([0, 2])
  })

  it('요구 루를 밟으면 풀린다', () => {
    const 미이행 = createRunner(1, 1, 주력500, { settled: true, requiredBase: 2, targetBase: 3 })
    expect(clearsRequirement(미이행)).toBe(false)
    const 이행 = createRunner(1, 1, 주력500, { settled: true, requiredBase: 2, targetBase: 2 })
    expect(clearsRequirement(이행)).toBe(true)
  })

  it('태그 거리는 499 다 (0xb36d0)', () => {
    expect(TAG_DISTANCE).toBe(499)
  })
})
