import { describe, expect, it } from 'vitest'
import { basePosition, runnerSpeedOf, stepToward } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import {
  buildRundownPlan,
  canStartRundown,
  chooseRundownRunner,
  endRundown,
  remainingPercentOf,
  rundownAction,
  rundownBasePoint,
  RUNDOWN_REMAINING_PERCENT,
} from '@/entities/fielding/model/rundown'

const 주력500 = runnerSpeedOf(500)
const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

/** 홈에 서 있는 타자주자 칸 — 주자 번호는 목록의 자리와 같다 (0xa9564 가 자리로 찾는다) */
const 타자주자 = createRunner(0, 0, 주력500)

/** 1루 → 2루 사이에서 진행률 p% 지점에 있는 주자 */
function 사이주자(index: number, percent: number): RunnerState {
  const from = basePosition(1)
  const to = basePosition(2)
  let position = from
  const speed = Math.max(1, Math.trunc((7772 * percent) / 100))
  position = stepToward(from, to, speed)
  return createRunner(index, 1, 주력500, { targetBase: 2, position, legStart: from })
}

const 문맥 = (play: Partial<PlayView>, runners: readonly RunnerState[]): DefenseContext => ({
  play: { ...initialPlayView(1), ...play },
  fielders: 야수들,
  runners,
  currentTick: 0,
  landingTick: 30,
})

describe('협살 대상 고르기 0xb398c — 남은 비율 > 35%', () => {
  it('35 는 즉시값으로 박혀 있다 (설정·난이도가 아니다)', () => {
    expect(RUNDOWN_REMAINING_PERCENT).toBe(35)
  })

  it('**루에 35% 미만으로 붙은 주자는 협살하지 않는다** (P2 의 방향이 반대였다)', () => {
    // 진행률 80% = 남은 20% → 대상 아님
    expect(remainingPercentOf(사이주자(1, 80))).toBeLessThan(35)
    expect(chooseRundownRunner([타자주자, 사이주자(1, 80)])).toBe(NONE)
    // 진행률 30% = 남은 70% → 대상
    expect(remainingPercentOf(사이주자(1, 30))).toBeGreaterThan(35)
    expect(chooseRundownRunner([타자주자, 사이주자(1, 30)])).toBe(1)
  })

  it('뒤 주자부터 본다', () => {
    expect(chooseRundownRunner([사이주자(0, 30), 사이주자(1, 30)])).toBe(1)
  })

  it('아웃됐거나 판정끝(+0x94)인 주자는 건너뛴다', () => {
    expect(chooseRundownRunner([{ ...사이주자(1, 30), isOut: true }])).toBe(NONE)
    expect(chooseRundownRunner([{ ...사이주자(1, 30), settled: true }])).toBe(NONE)
  })
})

describe('협살 계획 0xb3a04 · 시작 조건', () => {
  const 주자들 = [타자주자, 사이주자(1, 30)]

  it('두 루의 커버 야수와 대상 주자를 기록한다', () => {
    const 계획 = buildRundownPlan(문맥({ coverOfBase: [1, 2, 3, 4], ballHolderSlot: 2 }, 주자들), 1)
    expect(계획).toEqual({
      backFielder: 2, // 1루 커버
      frontFielder: 3, // 2루 커버
      backBase: 1,
      frontBase: 2,
      runnerIndex: 1,
      holderSide: 0, // 1루 쪽 야수가 공을 쥐었다
    })
    expect(rundownBasePoint(계획, 3)).toEqual(basePosition(2))
  })

  it('목표 루가 현재 루와 같으면 +1 한 루를 쓴다', () => {
    const 제자리 = createRunner(1, 1, 주력500, { targetBase: 1 })
    expect(buildRundownPlan(문맥({ coverOfBase: [1, 2, 3, 4] }, [타자주자, 제자리]), 1).frontBase).toBe(2)
  })

  it('**사람이 수비하면 협살이 일어나지 않는다** (state[0x31+수비측] == 1 일 때만)', () => {
    const 문 = 문맥({ coverOfBase: [1, 2, 3, 4], ballHolderSlot: 2 }, 주자들)
    expect(canStartRundown(문, true)).toBe(true)
    expect(canStartRundown(문, false)).toBe(false)
  })

  it('공 쥔 야수가 두 커버 중 하나가 아니면 시작하지 않는다', () => {
    const 문 = 문맥({ coverOfBase: [1, 2, 3, 4], ballHolderSlot: 8 }, 주자들)
    expect(canStartRundown(문, true)).toBe(false)
  })

  it('커버가 비어 있으면 시작하지 않는다', () => {
    const 문 = 문맥({ coverOfBase: [1, NONE, 3, 4], ballHolderSlot: 3 }, 주자들)
    expect(canStartRundown(문, true)).toBe(false)
  })
})

describe('협살 한 틱 0xb48b6', () => {
  const 주자들 = [타자주자, 사이주자(1, 30)]
  const 계획 = { backFielder: 2, frontFielder: 3, backBase: 1, frontBase: 2, runnerIndex: 1, holderSide: 0 }
  const 공목표 = { x: 24_000, y: 0, z: 23_000 }

  const 틱 = (slot: number, ballHolderSlot: number, overrides: Partial<DefenseContext> = {}) => ({
    ...문맥({ coverOfBase: [1, 2, 3, 4], ballHolderSlot, held: true }, 주자들),
    plan: 계획,
    slot,
    ballTarget: 공목표,
    ...overrides,
  })

  it('협살에서 빠지면 해제된다', () => {
    expect(rundownAction(틱(7, 2)).kind).toBe('협살해제')
    expect(rundownAction({ ...틱(2, 2), plan: { ...계획, runnerIndex: NONE } }).kind).toBe('협살해제')
  })

  it('아직 공을 못 잡았으면 공 쪽으로 간다', () => {
    expect(rundownAction(틱(2, 2))).toEqual({ kind: '공쫓기', target: 공목표 })
  })

  it('공을 쥐었고 내가 주자 뒤쪽 루를 보면 주자를 쫓는다', () => {
    const 야수 = 야수들.map((fielder, slot) => (slot === 2 ? { ...fielder, holdingBall: true } : fielder))
    expect(rundownAction(틱(2, 2, { fielders: 야수 }))).toEqual({ kind: '주자추적', runnerIndex: 1 })
  })

  it('공이 없는 쪽은 주자 도착이 송구 도착보다 4틱 넘게 늦을 때만 쫓아가고, 그 사이면 멈춰 기다린다', () => {
    // 2루수가 2루에 붙어 있으면 주자 16틱 > 송구 9틱 + 4 → 쫓아간다
    const 루위 = 야수들.map((fielder, slot) =>
      slot === 3 ? { ...fielder, position: basePosition(2) } : fielder,
    )
    expect(rundownAction(틱(3, 2, { fielders: 루위 })).kind).toBe('주자추적')
    // 제자리(2루수 시작 위치)면 주자 10틱 > 송구 6틱 이지만 +4 를 못 넘겨 대기다
    expect(rundownAction(틱(3, 2)).kind).toBe('대기')
  })

  it('주자가 코앞이면 내 루로 가서 밟는다', () => {
    const 붙은주자 = 사이주자(1, 30)
    const 야수 = 야수들.map((fielder, slot) =>
      slot === 3 ? { ...fielder, position: 붙은주자.position } : fielder,
    )
    const 결과 = rundownAction({ ...틱(3, 2, { fielders: 야수 }), plan: 계획 })
    expect(결과).toEqual({ kind: '루로', base: 2 })
  })
})

describe('협살 종료 0xb26b8', () => {
  it('상태 8 인 야수를 전부 상태 0 으로 되돌린다', () => {
    const 협살중 = 야수들.map((fielder, slot) =>
      slot === 2 || slot === 3 ? { ...fielder, aiState: AI_STATE.RUNDOWN } : fielder,
    )
    expect(endRundown(협살중).map((fielder) => fielder.aiState)).toEqual(Array(9).fill(AI_STATE.IDLE))
  })
})
