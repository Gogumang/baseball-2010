import { describe, expect, it } from 'vitest'
import {
  assignCoversForTick,
  baseAtPoint,
  needsCover,
} from '@/entities/fielding/model/coverAssignment'
import { basePosition, FIELDER_START_POSITIONS, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  AI_STATE,
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))
const 속도 = runnerSpeedOf(500)
/** 0xd8758 — 타구 판의 공 시작점 */
const 타격점 = { x: 20_000, y: 1_000, z: 30_000 }

const 문맥 = (
  play: Partial<PlayView>,
  runners: readonly RunnerState[] = [],
  fielders: readonly FielderState[] = 야수들,
): DefenseContext => ({
  play: { ...initialPlayView(1), ...play },
  fielders,
  runners,
  currentTick: 0,
  landingTick: 30,
})

const 고치기 = (slot: number, patch: Partial<FielderState>, base: readonly FielderState[] = 야수들) =>
  base.map((fielder) => (fielder.slot === slot ? { ...fielder, ...patch } : fielder))

const 돌리기 = (context: DefenseContext, ballToFirstSide = false, ballStartPoint = 타격점) =>
  assignCoversForTick({ context, ballToFirstSide, ballStartPoint })

describe('0xb1b88 — 그 루에 커버가 필요한가', () => {
  it('그 루 · 한 루 앞에 산 주자가 있거나, 두 루 앞 주자가 바로 앞 루로 가고 있으면 필요하다 (b1c0a)', () => {
    const 주자3루 = [createRunner(1, 3, 속도)]
    expect(needsCover(문맥({}, 주자3루), 0)).toBe(true)
    expect(needsCover(문맥({}, []), 0)).toBe(false)
    // 2루 주자가 3루로 가고 있으면 홈도 필요하다 (r − 2 = 2 · +0x7c == 3)
    expect(needsCover(문맥({}, [createRunner(1, 2, 속도, { targetBase: 3 })]), 0)).toBe(true)
    expect(needsCover(문맥({}, [createRunner(1, 2, 속도)]), 0)).toBe(false)
    // 타자주자는 +0x8c == 0 이라 1루는 늘 필요하다
    expect(needsCover(문맥({}, [createRunner(0, 0, 속도, { targetBase: 1 })]), 1)).toBe(true)
  })

  it('요구 루(+0x88 · +0x94)가 그 루인 산 주자가 있으면 필요하다 (b1bae) — 죽은 주자는 안 센다', () => {
    const 요구 = createRunner(1, 1, 속도, { targetBase: 2, requiredBase: 2 })
    expect(needsCover(문맥({}, [요구]), 2)).toBe(true)
    // r = 2: 루 2 · 루 1 의 주자가 없고(아웃), 루 0 도 없다
    expect(needsCover(문맥({}, [{ ...요구, isOut: true }]), 2)).toBe(false)
  })
})

describe('0xb1c90 커버 매 틱 다시 고르기 — 표 0xd8774 · b1d48 · b1e12 · b23a4 · b23dc · b2564', () => {
  it('포수·1루수·3루수가 공을 가지면 그 루를 투수에게 넘기고, 필요 없으면 비운다 (b1d48 · 0xb1b88)', () => {
    const 주자만루 = [createRunner(1, 1, 속도), createRunner(2, 2, 속도), createRunner(3, 3, 속도)]
    // 공 가진 기본 야수는 쫓는 중(AI 1)이다 — 쉬고(AI 0) 있으면 b23dc 가 커버를 되찾아 간다
    const 쫓는 = (slot: number) => 고치기(slot, { aiState: AI_STATE.CHASE })
    expect(돌리기(문맥({ ballHolderSlot: 1 }, 주자만루, 쫓는(1))).covers[0]).toBe(0)
    expect(돌리기(문맥({ ballHolderSlot: 1 }, [], 쫓는(1))).covers[0]).toBe(NONE)
    expect(돌리기(문맥({ ballHolderSlot: 4 }, 주자만루, 쫓는(4))).covers[3]).toBe(0)
    expect(돌리기(문맥({ ballHolderSlot: 2 }, [createRunner(0, 0, 속도, { targetBase: 1 })], 쫓는(2))).covers[1]).toBe(0)
    // 투수·외야수가 가지면 기본표 그대로
    expect(돌리기(문맥({ ballHolderSlot: 7 }, 주자만루)).covers).toEqual([1, 2, 3, 4])
  })

  it('기본 야수가 제 루를 목표로 서 있으면 넘기지 않고 투수를 AI 0 으로 돌린다 (b1d1a~b1d38)', () => {
    const 야수 = 고치기(2, { target: basePosition(1), aiState: AI_STATE.COVER_FIRST })
    const 답 = 돌리기(문맥({ ballHolderSlot: 2 }, [], 야수))
    expect(답.covers[1]).toBe(2)
    expect(답.idleSlots).toContain(0)
    // 쫓는 중(AI 1)이면 투수에게 넘기지만, 그 뒤 b23a4 가 "루로 가는 공 가진 야수" 로 다시 1루수를 커버로 적는다
    const 쫓기 = 돌리기(
      문맥(
        { ballHolderSlot: 2 },
        [createRunner(0, 0, 속도, { targetBase: 1 })],
        고치기(2, { target: basePosition(1), aiState: AI_STATE.CHASE }),
      ),
    )
    expect(쫓기.covers[1]).toBe(2)
    expect(쫓기.idleSlots).not.toContain(0)
  })

  it('2루 — 공 가진 야수가 2루수면 유격수, 유격수면 2루수, 아니면 공 방향 (b1e12)', () => {
    expect(돌리기(문맥({ ballHolderSlot: 3 })).covers[2]).toBe(5)
    expect(돌리기(문맥({ ballHolderSlot: 5 })).covers[2]).toBe(3)
    expect(돌리기(문맥({ ballHolderSlot: 7 }), true).covers[2]).toBe(5)
    expect(돌리기(문맥({ ballHolderSlot: 7 }), false).covers[2]).toBe(3)
    expect(돌리기(문맥({ ballHolderSlot: 7 }), false).secondBaseHelper).toBe(5)
  })

  it('도움 야수가 2루를 밟고 서 있으면 커버와 도움을 맞바꾼다 (b1e66)', () => {
    const 야수 = 고치기(5, { position: basePosition(2), target: basePosition(2) })
    const 답 = 돌리기(문맥({ ballHolderSlot: 7 }, [], 야수), false)
    expect(답.covers[2]).toBe(5)
    expect(답.secondBaseHelper).toBe(3)
  })

  it('타구가 아니면(공 시작점 ≠ 0xd8758) 2루가 필요 없을 때 2루에 가까운 쪽이 커버한다 (b1e86)', () => {
    const 홈 = basePosition(0)
    const 야수 = 고치기(5, { position: { x: 20_100, y: 0, z: 19_300 } })
    expect(돌리기(문맥({ ballHolderSlot: 1 }, [], 야수), false, 홈).covers[2]).toBe(5)
    // 타구 판이면 2루가 필요 없어도 b1e12 규칙(공 방향)이다
    expect(돌리기(문맥({ ballHolderSlot: 1 }, [], 야수), false, 타격점).covers[2]).toBe(3)
  })

  it('공 가진 야수가 루로 가고 있으면 그 루의 커버다 — AI 9 면 아니다 (b23a4)', () => {
    const 들고뛰기 = 고치기(7, { target: basePosition(3), aiState: AI_STATE.CARRY })
    expect(돌리기(문맥({ ballHolderSlot: 7 }, [], 들고뛰기)).covers[3]).toBe(7)
    const 미룸 = 고치기(7, { target: basePosition(3), aiState: AI_STATE.RECEIVE })
    expect(돌리기(문맥({ ballHolderSlot: 7 }, [], 미룸)).covers[3]).toBe(4)
  })

  it('대신 선 야수가 루에 닿았고 쉬는 기본 야수가 주자보다 먼저 닿으면 되찾는다 (b23dc · b2440)', () => {
    // 1루수가 공을 가져 투수가 1루 커버 — 투수가 1루에 서 있고, 1루수는 AI 0 으로 1루 옆에 쉬고 있다
    const 야수 = 고치기(0, { position: basePosition(1), target: basePosition(1), aiState: AI_STATE.COVER_FIRST }, 고치기(2, { aiState: AI_STATE.IDLE, position: { x: 25_900, y: 0, z: 24_100 }, target: { x: 25_900, y: 0, z: 24_100 } }))
    // 타자주자가 1루까지 한참 남았다
    const 타자주자 = createRunner(0, 0, 속도, { targetBase: 1 })
    const 답 = 돌리기(문맥({ ballHolderSlot: 2 }, [타자주자], 야수))
    expect(답.covers[1]).toBe(2)
    expect(답.idleSlots).toContain(0)
  })

  it('커버 야수는 AI 루 + 2 를 받는다 — AI 1 · 8 · 9 는 빼고 (b2564)', () => {
    const 답 = 돌리기(문맥({ ballHolderSlot: 7 }, [], 고치기(4, { aiState: AI_STATE.CHASE })))
    expect(답.coverStates).toContainEqual({ slot: 1, base: 0 })
    expect(답.coverStates).toContainEqual({ slot: 2, base: 1 })
    expect(답.coverStates.some((entry) => entry.slot === 4)).toBe(false)
  })

  it('어느 야수든 협살(AI 8)이면 그 틱은 안 돈다 — +0xf0 은 지난 값 그대로 (b1c96)', () => {
    const 답 = 돌리기(문맥({ ballHolderSlot: 7, coverOfBase: [1, 0, 3, 4] }, [], 고치기(6, { aiState: AI_STATE.RUNDOWN })))
    expect(답.ran).toBe(false)
    expect(답.covers).toEqual([1, 0, 3, 4])
  })

  it('목표점이 루 좌표와 좌표까지 같을 때만 그 루다 (0xb1268 · 야수 vt68)', () => {
    expect(baseAtPoint(basePosition(2))).toBe(2)
    expect(baseAtPoint(FIELDER_START_POSITIONS[3])).toBe(NONE)
  })
})
