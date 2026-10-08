import { describe, expect, it } from 'vitest'
import { basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  autoAdvanceDecisions,
  AUTO_ADVANCE_TICK_MARGIN,
  beatsThrow,
  clearsRequirement,
  isHeadingBack,
  isPathClear,
  requiredBasePinOf,
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
    // **2루를 밟고 선** 주자. 3루수가 좌중간 깊이 끌려 나가 있어 3루 도착이 78틱 이나 된다.
    // (원본이 재는 루는 `b = ([주자+0x8c] + 1) % 4` — **마지막으로 닿은 루**에서 한 칸이다)
    const 주자 = createRunner(1, 2, 주력500)
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
    const 주자 = createRunner(1, 2, 주력500)
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

  it('플레이가 끝났거나(+0x111) +0x129 면 틱 비교 없이 무조건 한 루 간다 (0xaf96e·0xaf978)', () => {
    const 주자 = createRunner(1, 2, 주력500, { targetBase: 2 })
    // 달리는 중인 주자는 force 없이는 원본도 건너뛴다 (0xaf950)
    const 달리는중 = createRunner(1, 2, 주력500, { targetBase: 3 })
    expect(
      autoAdvanceDecisions(문맥({ ballHolderSlot: 8, catchFielderSlot: 8, finished: true }, [달리는중])),
    ).toEqual([])
    // 두 칸이 서면 **진루 자리(0xafa0e)로 곧장 뛴다**
    for (const play of [{ finished: true }, { suppressed: true }]) {
      expect(
        autoAdvanceDecisions({
          ...문맥({ ballHolderSlot: 8, catchFielderSlot: 8, ...play }, [주자]),
          force: true,
        }),
      ).toEqual([{ runnerIndex: 1, toBase: 3 }])
    }
  })

  it('+0x111·+0x129 갈래는 종류 2·3·8 거르개도 "잡힐 뜬공" 도 안 본다 (0xaf9ac 앞에서 빠진다)', () => {
    const 주자 = createRunner(1, 2, 주력500, { targetBase: 2 })
    for (const kind of [2, 3, 8]) {
      expect(
        autoAdvanceDecisions({
          ...문맥({ kind, ballHolderSlot: 8, catchFielderSlot: 8, finished: true }, [주자]),
          force: true,
        }),
      ).toEqual([{ runnerIndex: 1, toBase: 3 }])
    }
    // vt94(잡힐 뜬공) 이고 아직 안 잡혔어도 마찬가지다
    expect(
      autoAdvanceDecisions({
        ...문맥(
          { ballHolderSlot: 8, catchFielderSlot: 8, earliestCatchTick: 5, everHeld: false, suppressed: true },
          [주자],
        ),
        force: true,
      }),
    ).toEqual([{ runnerIndex: 1, toBase: 3 }])
  })

  it('**달리는 중인 주자**가 force 일 때만 보이는 쪽이다 (0xaf950)', () => {
    // 0xaf950: `r0 = vt18(주자) ; r0 != 0 → 계속` — 루에 붙어 멈춘 주자는 force 없이도 본다
    const 멈춤 = createRunner(1, 2, 주력500) // 위치 == 목표 루
    const 문 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [멈춤], { fielders: 끌려나간수비 })
    expect(autoAdvanceDecisions(문)).toEqual([{ runnerIndex: 1, toBase: 3 }])
    expect(autoAdvanceDecisions({ ...문, force: true })).toEqual([{ runnerIndex: 1, toBase: 3 }])

    // 달리는 중인 주자는 거꾸로다 — force 가 있어야 본다
    const 달림 = createRunner(1, 2, 주력500, { targetBase: 3 })
    const 문2 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [달림], { fielders: 끌려나간수비 })
    expect(autoAdvanceDecisions(문2)).toEqual([])
    // 재는 루는 **닿은 루(2)+1 = 3** 이라, 이미 3루로 뛰는 주자에게는 같은 루를 다시 이른다
    expect(autoAdvanceDecisions({ ...문2, force: true })).toEqual([{ runnerIndex: 1, toBase: 3 }])
  })

  it('앞길이 막혀 있으면 안 간다 (0xa9924)', () => {
    const 뒤 = createRunner(1, 2, 주력500)
    const 앞 = createRunner(2, 3, 주력500)
    const 문 = 문맥({ ballHolderSlot: 8, catchFielderSlot: 8 }, [뒤, 앞], { fielders: 끌려나간수비 })
    // 앞 주자가 3루를 딛고 있으니 뒤 주자는 3루로 못 간다 (앞 주자 혼자 홈으로 간다)
    expect(autoAdvanceDecisions(문).map((decision) => decision.runnerIndex)).toEqual([2])
    // 앞길 검사를 갈아 끼우면 둘 다 막힌다
    expect(autoAdvanceDecisions({ ...문, isPathClear: () => false })).toEqual([])
  })

  it('플레이 종류 7 은 틱을 안 보고 바로 간다 (투구 때 루+2 까지만)', () => {
    const 주자 = createRunner(1, 1, 주력500, { pitchBase: 0 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [주자]))).toEqual([{ runnerIndex: 1, toBase: 2 }])
    // 이미 투구 때 루+2 에 닿았으면 더 안 간다 (2 ≥ 0+2)
    const 이미 = createRunner(1, 2, 주력500, { pitchBase: 0 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [이미]))).toEqual([])
  })

  it('종류 7 은 **닿은 루(+0x8c) ≥ 투구 때 루(+0x90)+2** 면 멈춘다 (0xaf97e)', () => {
    // 1루에서 출발해 3루까지 밟았다: 닿은 루 3, 투구 때 루 1 → 3 ≥ 1+2 이라 더 안 간다
    const 두루째 = createRunner(1, 3, 주력500, { pitchBase: 1 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [두루째]))).toEqual([])
    // 아직 한 루만 갔으면(2 < 1+2) 또 간다
    const 한루째 = createRunner(1, 2, 주력500, { pitchBase: 1 })
    expect(autoAdvanceDecisions(문맥({ kind: 7 }, [한루째]))).toEqual([{ runnerIndex: 1, toBase: 3 }])
  })
})

describe('포스와 태그업 — 요구 루 세우기', () => {
  it('공이 땅에 닿으면 포스: **마지막으로 닿은 루**(+0x8c) ≤ 주자 번호면 요구 루 = 투구 때 루 + 1 (0xa95e8)', () => {
    // 0xa95e8 이 보는 왼쪽 항은 `[주자+0x8c]` = **마지막으로 닿은 루**(이 모델의 `startBase`),
    // 달려가는 루(+0x7c = `targetBase`)가 아니다. 뛰기 시작했다고 포스가 풀리지는 않는다.
    const 주자들 = [
      createRunner(0, 0, 주력500, { targetBase: 1, pitchBase: 0 }),
      createRunner(1, 1, 주력500, { targetBase: 2, pitchBase: 1 }),
      createRunner(2, 2, 주력500, { targetBase: 3, pitchBase: 2 }),
    ]
    // 셋 다 아직 제 루를 딛고 있다(0·1·2) → 번호 0·1·2 이하라 전원 포스
    expect(requiredBasesOnBounce(주자들)).toEqual([1, 2, 3])
  })

  it('앞선 루를 이미 밟았으면 포스가 풀린다 — 왼쪽 항이 **닿은 루**이기 때문 (0xa95e8)', () => {
    const 주자들 = [
      createRunner(0, 0, 주력500, { targetBase: 1, pitchBase: 0 }),
      // 1루 주자가 이미 2루를 밟고 3루로 뛴다: 닿은 루 2 > 번호 1 → 요구 없음
      createRunner(1, 2, 주력500, { targetBase: 3, pitchBase: 1 }),
    ]
    expect(requiredBasesOnBounce(주자들)).toEqual([1, NONE])
  })

  it('주자 번호는 빈 루를 건너뛴 **목록 번호**다 — 2루 주자만 있으면 번호 1 (0xa9a10·0xa93ac)', () => {
    // 원본 목록도 `[타자주자, 2루 주자]` 두 칸뿐이다. 2루 주자의 번호는 2 가 아니라 1.
    const 주자들 = [
      createRunner(0, 0, 주력500, { targetBase: 1, pitchBase: 0 }),
      createRunner(1, 2, 주력500, { targetBase: 2, pitchBase: 2 }),
    ]
    // 타자주자: 닿은 루 0 ≤ 번호 0 → 요구 1루(타자주자는 언제나 포스다).
    // 2루 주자: 닿은 루 2 > 번호 1 → 요구 없음 — **1루가 비었으니 포스가 아니다**.
    expect(requiredBasesOnBounce(주자들)).toEqual([1, NONE])

    // 1·2루면 목록은 `[타자주자, 1루 주자, 2루 주자]` — 셋 다 포스다
    const 일이루 = [
      createRunner(0, 0, 주력500, { targetBase: 0, pitchBase: 0 }),
      createRunner(1, 1, 주력500, { targetBase: 1, pitchBase: 1 }),
      createRunner(2, 2, 주력500, { targetBase: 2, pitchBase: 2 }),
    ]
    expect(requiredBasesOnBounce(일이루)).toEqual([1, 2, 3])
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

describe('주자 틱 a028c — 요구 루(+0x88)를 밟기 전에는 그 너머로 못 간다 (requiredBasePinOf)', () => {
  it('요구 루가 없으면 목표 그대로', () => {
    expect(requiredBasePinOf(createRunner(1, 2, 300, { targetBase: 3 }))).toBe(3)
  })
  it('리터치(요구 루 = 투구 루 2)인데 자동 진루가 3루로 보냈으면 2루로 되돌린다 — max(+0x88, min(+0x80, +0x8c))', () => {
    expect(requiredBasePinOf(createRunner(1, 2, 300, { targetBase: 3, requiredBase: 2 }))).toBe(2)
  })
  it('포스(요구 루 = 다음 루)로 달리는 중이면 그대로', () => {
    expect(requiredBasePinOf(createRunner(1, 1, 300, { targetBase: 2, requiredBase: 2 }))).toBe(2)
  })
  it('이미 요구 루 너머에 닿은 주자는 닿은 루에 선다 (+0x8c > +0x88)', () => {
    expect(requiredBasePinOf(createRunner(1, 3, 300, { startBase: 3, targetBase: 4, requiredBase: 2 }))).toBe(3)
  })
})

describe('앞길 검사 0xa9924 · 방향 판정 0x9fe80 — 원본 갈래 그대로', () => {
  /** 루 from 에서 to 로 막 출발한 주자 (위치는 아직 출발 루) */
  const 출발 = (index: number, from: number, to: number): RunnerState =>
    createRunner(index, from, 주력500, { targetBase: to })
  /** 루 b 에 멈춰 선 주자 */
  const 선 = (index: number, b: number): RunnerState => createRunner(index, b, 주력500)

  it('0x9fe80 — 앞으로(+0x7c > +0x8c)는 0 · 뒤로(+0x7c < +0x8c)는 1 · 루에 멈춰 선 주자(+0x84 == +0x8c)는 1', () => {
    expect(isHeadingBack(출발(1, 1, 2), 1)).toBe(false)
    expect(isHeadingBack(출발(1, 2, 1), 2)).toBe(true)
    expect(isHeadingBack(선(1, 2), 2)).toBe(true)
    // 3루 → 홈은 +0x7c 4(또는 0) — 9fe92 가 0 을 4 로 고쳐 앞으로다
    expect(isHeadingBack(출발(1, 3, 0), 3)).toBe(false)
    // 제 루로 되돌아가는 중(+0x7c == +0x8c, 위치 ≠ 목표점)은 1
    const 귀루: RunnerState = { ...선(1, 1), position: { ...basePosition(1), x: basePosition(1).x + 600 } }
    expect(isHeadingBack(귀루, 2)).toBe(true)
  })

  it('앞 주자가 서 있으면 바로 앞 루가 비어야 한다 (r6+1 < r7) — 타자주자(r6 == 0)는 늘 통과', () => {
    expect(isPathClear(선(1, 1), [선(0, 0), 선(1, 1), 선(2, 2)])).toBe(false)
    expect(isPathClear(선(1, 1), [선(0, 0), 선(1, 1), 선(2, 3)])).toBe(true)
    expect(isPathClear(선(0, 0), [선(0, 0), 선(1, 1)])).toBe(true)
  })

  it('앞 주자가 앞으로 달리는 중이면 r6 < r7 로 통과 — 예전 근사("그 루를 목표로 삼은 주자가 없다")와 다른 자리', () => {
    // 2루 주자가 3루로 막 출발했다 — 1루 주자는 2루로 갈 수 있다(예전 근사도 통과)
    expect(isPathClear(선(1, 1), [선(0, 0), 선(1, 1), 출발(2, 2, 3)])).toBe(true)
    // 3루 주자가 홈으로 달리는 중 — 2루 주자(r6 2 < r7 3)도 통과
    expect(isPathClear(선(1, 2), [선(0, 0), 선(1, 2), 출발(2, 3, 4)])).toBe(true)
    // 앞 주자가 아직 내 루(+0x8c == r6)를 떠나는 중이면 막힌다 — r6 < r7 이 거짓
    expect(isPathClear(선(1, 1), [선(0, 0), 선(1, 1), 출발(2, 1, 2)])).toBe(false)
    // 만루 단타 꼴: 1·2·3루 주자가 모두 출발했으면 1루 주자의 앞(2루 주자, +0x8c 2)은 앞으로 — 통과.
    // 예전 근사("내 다음 루를 목표로 삼은 산 주자가 없다")는 2루 주자의 목표가 3 이라 같은 답이지만,
    // 2루 주자가 3루에 닿아(+0x8c 3) 홈으로 다시 출발한 뒤 1루 주자가 3루를 노리면 예전 근사는 막지 않고 원본도 통과한다
    expect(isPathClear(출발(1, 1, 2), [선(0, 0), 출발(1, 1, 2), 출발(2, 2, 3)])).toBe(true)
  })

  it('죽은 주자는 건너뛰고 그다음 산 주자를 본다 (0xa97d4 의 +0x96)', () => {
    const 죽은 = { ...선(2, 2), isOut: true }
    expect(isPathClear(선(1, 1), [선(0, 0), 선(1, 1), 죽은, 선(3, 3)])).toBe(true)
    expect(isPathClear(선(1, 2), [선(0, 0), 선(1, 2), 죽은, 선(3, 3)])).toBe(false)
  })
})
