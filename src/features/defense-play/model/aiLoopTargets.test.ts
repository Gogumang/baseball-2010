import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import { POSE, RETURN_SLACK_TICKS, canStepNextListTick, listTickFielder, withReturnToStartTick } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, createFielders, initialPlayView } from '@/entities/fielding/model/fieldingState'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { runCoverTick } from '@/features/defense-play/model/coverTick'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

describe('AI 0xf — 0xb2c58 이 사건 7 · 12 에 아홉 야수에 건다 · b4c2a vt14(시작 자리) · vt8c(5) (r190)', () => {
  it('첫 고리만 목표를 받고 +0xcc = 5 — 그 뒤로는 vtc8 이 닫혀 목표를 안 받는다', () => {
    const 유격 = { ...야수들[5], target: { x: 1, y: 0, z: 2 }, aiState: AI_STATE.RETURN }
    const 첫 = withReturnToStartTick(유격)
    expect(첫.target).toEqual(FIELDER_START_POSITIONS[5])
    expect(첫.arrivalSlackTicks).toBe(RETURN_SLACK_TICKS)
    // 다음 목록 틱 a1330 이 4 로 줄여도 vtc8 이 거짓 — a143e 지우기가 vt10(목표 = 위치)
    const 목록틱 = listTickFielder({ ...첫, position: { x: 500, y: 0, z: 600 } })
    expect(목록틱.arrivalSlackTicks).toBe(RETURN_SLACK_TICKS - 1)
    expect(목록틱.target).toEqual({ x: 500, y: 0, z: 600 })
    const 둘째 = withReturnToStartTick(목록틱)
    expect(둘째.target).toEqual({ x: 500, y: 0, z: 600 })
    expect(둘째.arrivalSlackTicks).toBe(RETURN_SLACK_TICKS)
  })

  it('잠긴 야수 · 던진 뒤(+0xb1) 야수는 vt14 가 목표를 안 받는다 — +0xcc 는 그래도 5', () => {
    const 목표 = { x: 1, y: 0, z: 2 }
    const 잠김 = withReturnToStartTick({ ...야수들[3], target: 목표, actionLockTicks: 4 })
    expect(잠김.target).toEqual(목표)
    expect(잠김.arrivalSlackTicks).toBe(RETURN_SLACK_TICKS)
    const 던짐 = withReturnToStartTick({ ...야수들[3], target: 목표, pose: POSE.THROWN })
    expect(던짐.target).toEqual(목표)
  })

  it('다음 목록 틱의 이동 관문은 a1330 에서 하나 줄인 +0xcc 로 본다 — 1 이면 걷고 2 이상이면 못 걷는다', () => {
    expect(canStepNextListTick({ ...야수들[0], arrivalSlackTicks: 1 })).toBe(true)
    expect(canStepNextListTick({ ...야수들[0], arrivalSlackTicks: 2 })).toBe(false)
    expect(canStepNextListTick({ ...야수들[0], arrivalSlackTicks: RETURN_SLACK_TICKS })).toBe(false)
  })

  it('파울(7)을 받은 틱부터 야수는 그 자리에 선다 — 결과 · 굴림은 그대로', () => {
    // 뒤로 튄 파울(코드 9 [311, 273, 247]) — 3틱 낙구에 7
    const 결과 = runDefensePlay({
      outcome: registerContact(땅볼아웃, { batterHand: 0, pattern: [311, 273, 247, 1], resultCode: 9 }),
      trajectory: battedBallTrajectory([311, 273, 247, 1]),
      bases: EMPTY_BASES,
      outs: 0,
    })
    expect(결과.log).toContain('3틱 낙구 — 판 끝 결과 코드 7 (0x9d5bc)')
    expect(결과.log).toContain('3틱 사건 7 — 야수 9명 AI 0xf (0xb2c58)')
    const 자리 = (index: number) => 결과.ticks[index].fielders.map((fielder) => [fielder.x, fielder.z])
    const 사건틱 = 결과.ticks.findIndex((view) => view.tick === 3)
    for (let index = 사건틱 + 1; index < 결과.ticks.length; index += 1) {
      expect(자리(index)).toEqual(자리(사건틱 + 1))
    }
  })
})

describe('추적야수 AI 1(b4aca)의 목표 고치기는 AI 고리 안 — 같은 틱 끝 b4c72 가 고친 목표를 본다 (r190)', () => {
  it("중계 자리 b203a 가 이번 틱 목표로 잡혀 외야 송구의 중계 도착이 한 틱 늦다 (CPU 표 18/26 · 사람 '6')", () => {
    // 예전 웹은 추적야수 목표를 6 절 걸음에서 고쳐, 낙구점 → 포구점으로 바뀐 틱의 커버 다시 고르기가 옛 목표(낙구점)로 중계 자리를 잡았다
    const pattern = BATTED_BALL_PATTERNS[18][26]
    const 결과 = runDefensePlay({
      outcome: registerContact(땅볼아웃, { batterHand: 0, pattern, resultCode: 18 }),
      trajectory: battedBallTrajectory(pattern),
      bases: EMPTY_BASES,
      outs: 0,
      random: createSeededRandom(1),
      controls: { side: '수비', keyAt: () => ({ key: '6', isRepeat: false }) },
    })
    // 야수 걸음이 맨해튼 거리(0xbf158 → 0xbfa2c)로 나뉘어 외야수가 44틱에 잡고 50틱에 던진다
    expect(결과.log).toContain('50틱 1루로 송구 — 61틱 도착 (3번 야수 중계) (6번 야수)')
  })
})

describe('키스톤 자리 잡기 0xb203a 의 목표는 vt14 관문을 지난다 — AI 0xa 는 관문 없이 (r190)', () => {
  const 자리잡기 = (lock: number) =>
    runCoverTick({
      context: {
        play: { ...initialPlayView(1), ballHolderSlot: 4, catchFielderSlot: 4 },
        fielders: 야수들.map((fielder) => (fielder.slot === 5 ? { ...fielder, actionLockTicks: lock } : fielder)),
        runners: [],
        currentTick: 0,
        landingTick: 30,
      },
      ballToFirstSide: false,
      ballStartPoint: { x: 20_000, y: 1000, z: 30_000 },
      relayFlag: true,
    }).fielders[5]

  it('풀린 유격수는 표 0xd8764 자리 (14500, 17600) 로 목표를 받는다', () => {
    const 유격 = 자리잡기(0)
    expect(유격.aiState).toBe(AI_STATE.BUSY)
    expect(유격.target).toEqual({ x: 14_500, y: 0, z: 17_600 })
  })

  it('잠긴 유격수는 AI 0xa 만 되고 목표는 그대로다', () => {
    const 유격 = 자리잡기(3)
    expect(유격.aiState).toBe(AI_STATE.BUSY)
    expect(유격.target).toEqual(야수들[5].target)
  })
})
