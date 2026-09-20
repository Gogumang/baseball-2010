import { describe, expect, it } from 'vitest'
import {
  MAXIMUM_BURSTS_PER_GAME,
  canTriggerBurst,
  createBurstSession,
  resolveBurst,
  tryTriggerBurst,
} from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_GOAL } from '@/entities/burst-mission/model/burstMissionJudge'
import { BURST_MODE } from '@/entities/burst-mission/model/burstMissionRow'
import { BURST_REWARD_KIND } from '@/entities/burst-mission/model/burstMissionReward'
import { BURST_RESULT_BIT as B, burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import type { BurstTriggerContext } from '@/entities/burst-mission/model/burstMissionTrigger'
import { 행 } from '@/entities/burst-mission/model/burstMissionTestRows'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 언제나통과 = (): RandomPort => ({
  next: () => 0,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

const 상황: BurstTriggerContext = {
  isHumanTeamBatting: true,
  bases: { first: false, second: false, third: false },
  outs: 0,
  inning: 0,
  ourScore: 0,
  opponentScore: 0,
  opponentBattingSlot: 0,
  opponentAceBatterId: null,
  opponentAcePitcherId: null,
  hitsInGame: 0,
  homeRunsInGame: 0,
  strikeoutsInGame: 0,
}

const 안타미션 = 행({
  index: 4,
  goal: BURST_GOAL.안타,
  successRewards: [
    { kind: BURST_REWARD_KIND.인기도, amount: 2 },
    { kind: BURST_REWARD_KIND.평판, amount: 3 },
  ],
  failurePenalty: { kind: BURST_REWARD_KIND.평판, amount: 3 },
})

describe('돌발 객체 만들기 (로더 0x8e1b0)', () => {
  it('모드 2·3·4 에서만 만들어진다 (0x48658 의 모드−2 ≤ 2)', () => {
    expect(createBurstSession(BURST_MODE.시즌)?.table).toBe('SEASON')
    expect(createBurstSession(BURST_MODE.나리투수)?.table).toBe('PITCHER')
    expect(createBurstSession(BURST_MODE.나리타자)?.table).toBe('BATTER')
    expect(createBurstSession(0)).toBeNull()
    expect(createBurstSession(6)).toBeNull()
  })

  it('경기당 최대 발동 횟수는 1 이다 (obj+0x229)', () => {
    expect(MAXIMUM_BURSTS_PER_GAME).toBe(1)
    expect(createBurstSession(BURST_MODE.나리타자)?.maximumTriggers).toBe(1)
  })
})

describe('발동 (0x8f158)', () => {
  it('타석 준비 때 뽑히면 현재 돌발이 차고 발동 횟수가 오른다', () => {
    const session = createBurstSession(BURST_MODE.나리타자)!
    const 발동됨 = tryTriggerBurst(session, 상황, 언제나통과(), [안타미션])

    expect(발동됨.current?.index).toBe(4)
    expect(발동됨.triggeredCount).toBe(1)
  })

  it('경기당 한 번뿐이다 — 판정이 끝난 뒤에도 다시 발동하지 않는다', () => {
    const session = createBurstSession(BURST_MODE.나리타자)!
    const 발동됨 = tryTriggerBurst(session, 상황, 언제나통과(), [안타미션])
    const 판정뒤 = resolveBurst(발동됨, B.홈런).session

    expect(판정뒤.current).toBeNull()
    expect(canTriggerBurst(판정뒤)).toBe(false)
    expect(tryTriggerBurst(판정뒤, 상황, 언제나통과(), [안타미션]).current).toBeNull()
  })

  it('이미 진행 중이면 새로 뽑지 않는다', () => {
    const session = createBurstSession(BURST_MODE.나리타자)!
    const 발동됨 = tryTriggerBurst(session, 상황, 언제나통과(), [안타미션])

    expect(canTriggerBurst(발동됨)).toBe(false)
  })

  it('원본 표가 아직 없어서 행을 넘기지 않으면 발동하지 않는다', () => {
    const session = createBurstSession(BURST_MODE.시즌)!

    expect(tryTriggerBurst(session, 상황, 언제나통과()).current).toBeNull()
  })
})

describe('판정 (0x8f414) — 타석이 끝날 때', () => {
  const 발동된세션 = () =>
    tryTriggerBurst(createBurstSession(BURST_MODE.나리타자)!, 상황, 언제나통과(), [안타미션])

  it('단타를 치면 성공하고 보상 두 개가 나온다', () => {
    const 결과 = resolveBurst(
      발동된세션(),
      burstResultBitsOf({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 0, outsBefore: 0, outsAdded: 0 }),
    )

    expect(결과.judgement).toBe('성공')
    expect(결과.deltas).toEqual([
      { name: '인기도', amount: 2 },
      { name: '평판', amount: 3 },
    ])
    expect(결과.session.current).toBeNull()
    expect(결과.session.judgement).toBe('성공')
  })

  it('삼진이면 실패하고 페널티가 붙는다', () => {
    const 결과 = resolveBurst(
      발동된세션(),
      burstResultBitsOf({ outcome: { kind: '삼진' }, runsBattedIn: 0, outsBefore: 0, outsAdded: 1 }),
    )

    expect(결과.judgement).toBe('실패')
    expect(결과.deltas).toEqual([{ name: '평판', amount: -3 }])
  })

  it('희생번트로 끝나면 무효라 보상이 없다', () => {
    const 결과 = resolveBurst(발동된세션(), B.번트진루 | B.아웃)

    expect(결과.judgement).toBe('무효')
    expect(결과.deltas).toEqual([])
    expect(결과.session.current).toBeNull()
  })

  it('결과비트가 0 이면 돌발이 그대로 살아 있다', () => {
    const 결과 = resolveBurst(발동된세션(), 0)

    expect(결과.judgement).toBeNull()
    expect(결과.session.current?.index).toBe(4)
  })

  it('진행 중인 돌발이 없으면 아무 일도 없다', () => {
    const session = createBurstSession(BURST_MODE.나리타자)!

    expect(resolveBurst(session, B.홈런)).toEqual({ session, row: null, judgement: null, deltas: [] })
  })
})
