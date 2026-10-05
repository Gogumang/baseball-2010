import { describe, expect, it } from 'vitest'
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  recordPitch,
  startPitcherMission,
  inningGoalOf,
  OUTS_PER_INNING,
} from '@/entities/mission/model/pitcherRun'
import { PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { missionDefensePlayInputOf } from '@/entities/mission/model/missionRun'
import { runDefensePlay, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerFate } from '@/features/defense-play/model/runnerFates'
import type { AdvanceResult } from '@/entities/game/model/baseState'

const 혼이실린 = PITCHER_MISSIONS.find((m) => m.name === '혼이 실린 스트라이크')!
const 착각하지마 = PITCHER_MISSIONS.find((m) => m.name.includes('착각하지마'))!
const 깔끔한마무리 = PITCHER_MISSIONS.find((m) => m.name === '깔끔한 마무리')!
const 연속삼진쇼 = PITCHER_MISSIONS.find((m) => m.name === '연속 삼진 쇼')!

describe('투구 수 제한 — 원본 레코드 값이 설명문과 같다', () => {
  it('"10개의 공으로 2삼진을 잡아라!" 에서 10을 읽는다', () => {
    expect(startPitcherMission(혼이실린).remainingPitches).toBe(10)
  })

  it('"6개의 공으로 삼진을 잡아라!" 에서 6을 읽는다', () => {
    expect(startPitcherMission(착각하지마).remainingPitches).toBe(6)
  })

  it('투구 수 제한이 없으면 null이다', () => {
    expect(startPitcherMission(깔끔한마무리).remainingPitches).toBeNull()
  })
})

describe('startPitcherMission', () => {
  it('투구 수 제한이 있는 미션은 남은 투구가 설정된다', () => {
    const run = startPitcherMission(혼이실린)

    expect(run.remainingPitches).toBe(10)
    expect(run.status).toBe('진행중')
  })

  it('제한 시간이 있는 미션은 남은 시간이 설정된다', () => {
    expect(startPitcherMission(연속삼진쇼).remainingSeconds).toBe(연속삼진쇼.timeLimitSeconds)
  })

  it('투구 수 제한이 있으면 타석 제한은 쓰지 않는다', () => {
    expect(startPitcherMission(혼이실린).remainingPlateAppearances).toBeNull()
  })
})

describe('recordPitch', () => {
  it('공을 던질 때마다 남은 투구가 줄어든다', () => {
    let run = startPitcherMission(혼이실린)
    run = recordPitch(run, false)
    run = recordPitch(run, false)

    expect(run.remainingPitches).toBe(8)
  })

  it('PERFECT 게이지가 쌓인다', () => {
    let run = startPitcherMission(혼이실린)
    run = recordPitch(run, true)
    run = recordPitch(run, true)

    expect(run.perfectGauges).toBe(2)
  })

  it('끝난 미션은 바뀌지 않는다', () => {
    const 끝난것 = { ...startPitcherMission(혼이실린), status: '실패' as const }

    expect(recordPitch(끝난것, true)).toBe(끝난것)
  })
})

describe('applyPitcherOutcome', () => {
  it('목표를 채우면 성공이다', () => {
    let run = startPitcherMission(혼이실린) // 10개의 공으로 2삼진
    run = applyPitcherOutcome(run, { kind: '삼진' })
    expect(run.status).toBe('진행중')

    run = applyPitcherOutcome(run, { kind: '삼진' })

    expect(run.status).toBe('성공')
  })

  it('투구 수를 다 쓰면 실패다', () => {
    let run = startPitcherMission(착각하지마) // 6개의 공
    for (let i = 0; i < 6; i += 1) run = recordPitch(run, false)

    run = applyPitcherOutcome(run, { kind: '아웃', detail: '땅볼아웃' })

    expect(run.status).toBe('실패')
  })

  it('타석이 끝나면 PERFECT 게이지 누적이 초기화된다', () => {
    let run = startPitcherMission(혼이실린)
    run = recordPitch(run, true)

    run = applyPitcherOutcome(run, { kind: '삼진' })

    expect(run.perfectGauges).toBe(0)
  })

  it('PERFECT 게이지가 MAX게이지 목표에 반영된다', () => {
    let run = startPitcherMission(혼이실린)
    run = recordPitch(run, true)
    run = recordPitch(run, true)

    run = applyPitcherOutcome(run, { kind: '아웃', detail: '땅볼아웃' })

    expect(run.progress.counts['MAX게이지']).toBe(2)
  })

  it('입력 상태를 변경하지 않는다', () => {
    const before = startPitcherMission(혼이실린)

    applyPitcherOutcome(before, { kind: '삼진' })

    expect(before.progress.plateAppearances).toBe(0)
  })
})

describe('checkPitchExhausted', () => {
  it('투구 수가 남아 있으면 그대로다', () => {
    const run = startPitcherMission(혼이실린)

    expect(checkPitchExhausted(run)).toBe(run)
  })

  it('투구 수를 다 쓰면 타석 도중이라도 실패다', () => {
    let run = startPitcherMission(착각하지마)
    for (let i = 0; i < 6; i += 1) run = recordPitch(run, false)

    expect(checkPitchExhausted(run).status).toBe('실패')
  })

  it('투구 수 제한이 없으면 아무것도 안 한다', () => {
    const run = startPitcherMission(깔끔한마무리)

    expect(checkPitchExhausted(run)).toBe(run)
  })
})

describe('이닝 단위 미션 — 노히트노런 · 퍼펙트게임', () => {
  const 노히트노런 = PITCHER_MISSIONS.find((m) => m.name === '도전! 노히트 노런')!
  const 퍼펙트 = PITCHER_MISSIONS.find((m) => m.name === '완벽한 승리자')!

  it('설명문에서 목표 이닝을 읽는다', () => {
    expect(inningGoalOf(노히트노런)).toBe(5)
    expect(inningGoalOf(퍼펙트)).toBe(6)
  })

  it('이닝 미션이 아니면 null이다', () => {
    expect(inningGoalOf(혼이실린)).toBeNull()
  })

  it('아웃을 3×이닝만큼 잡으면 성공이다', () => {
    let run = startPitcherMission(노히트노런)
    for (let i = 0; i < 5 * OUTS_PER_INNING - 1; i += 1) {
      run = applyPitcherOutcome(run, { kind: '삼진' })
      expect(run.status, `${i + 1}번째 아웃`).toBe('진행중')
    }

    run = applyPitcherOutcome(run, { kind: '삼진' })

    expect(run.totalOuts).toBe(15)
    expect(run.status).toBe('성공')
  })

  it('안타를 맞으면 노히트노런은 즉시 실패다', () => {
    let run = startPitcherMission(노히트노런)
    run = applyPitcherOutcome(run, { kind: '삼진' })

    run = applyPitcherOutcome(run, { kind: '안타', bases: 1 })

    expect(run.status).toBe('실패')
  })

  /**
   * 노히트노런 *목표 막대*(`recordPitcherOutcome`)는 볼넷으로 깨지지 않지만, 13번 레코드의 넷째 실패 한도
   * +0xa3 = 1 ↔ R+0x130(출루 허용)이 볼넷 타자로 1 이 되어 **미션은 실패**다 (아래 '넷째 실패 한도' 묶음).
   */
  it('볼넷은 노히트노런 막대는 지키지만 13번 미션은 출루 허용 한도로 실패다', () => {
    let run = startPitcherMission(노히트노런)

    run = applyPitcherOutcome(run, { kind: '볼넷' })

    expect(run.progress.counts['노히트노런']).toBe(0)
    expect(run.progress.brokenConditions).toEqual(['무출루'])
    expect(run.status).toBe('실패')
  })

  it('볼넷은 퍼펙트게임을 깬다 — 주자를 내보내면 안 된다', () => {
    let run = startPitcherMission(퍼펙트)

    run = applyPitcherOutcome(run, { kind: '볼넷' })

    expect(run.status).toBe('실패')
  })

  it('아웃만 쌓이면 퍼펙트게임도 성공한다', () => {
    let run = startPitcherMission(퍼펙트)
    for (let i = 0; i < 6 * OUTS_PER_INNING; i += 1) {
      run = applyPitcherOutcome(run, { kind: '아웃', detail: '땅볼아웃' })
    }

    expect(run.status).toBe('성공')
  })

  it('안타를 맞지 않는 아웃은 이닝이 쌓인다', () => {
    let run = startPitcherMission(노히트노런)
    run = applyPitcherOutcome(run, { kind: '아웃', detail: '뜬공아웃' })
    run = applyPitcherOutcome(run, { kind: '삼진' })

    expect(run.outs).toBe(2)
  })
})

/**
 * 투수편 미션도 타자편과 **같은** `missionAdvance` 를 탄다 — 원본 수비 시뮬레이션
 * (태그업 0xa9620 + 자동 진루 0xaf918 + 2아웃 득점 보류, P2 7절 · U-02).
 * 실점(`allowed.runs`)과 아웃(`totalOuts`)이 그 결과를 그대로 받는다.
 */
describe('수비 진행 — 미션도 수비 시뮬레이션이 돌린다 (P2 7절 · U-02)', () => {
  const 사우팅 = PITCHER_MISSIONS.find((m) => m.name.includes('영혼의 사우팅'))!

  it('2루 주자가 있으면 단타에 1실점이다 — 고정 진루표 근사(0실점)가 아니다', () => {
    expect(사우팅.start.runners).toEqual({ first: false, second: true, third: false })

    const run = applyPitcherOutcome(startPitcherMission(사우팅), { kind: '안타', bases: 1 })

    expect(run.allowed.runs).toBe(1)
    expect(run.bases).toEqual({ first: true, second: false, third: false })
  })

  it('1·3루 땅볼은 병살이 되어 아웃 두 개가 쌓이고 3루 주자는 못 들어온다', () => {
    const 챔피언 = PITCHER_MISSIONS.find((m) => m.name === '최강의 챔피언')!
    expect(챔피언.start.runners).toEqual({ first: true, second: false, third: true })

    const run = applyPitcherOutcome(startPitcherMission(챔피언), { kind: '아웃', detail: '땅볼아웃' })

    expect(run.totalOuts).toBe(2)
    expect(run.allowed.runs).toBe(0)
  })
})

describe('넷째 실패 한도 +0xa3 ↔ R+0x130 출루 허용 (정산 0xa8c86 · 판정 0xaaccc)', () => {
  const 노히트노런 = PITCHER_MISSIONS.find((m) => m.id === 13)!
  const 퍼펙트 = PITCHER_MISSIONS.find((m) => m.id === 14)!

  it('원본 표에서 +0xa3 이 1 인 것은 투수 13·14 번뿐이다', () => {
    expect(PITCHER_MISSIONS.filter((m) => m.failLimits.baserunners > 0).map((m) => m.id)).toEqual([13, 14])
  })

  it('노히트노런(13번)도 볼넷 하나로 실패다 — 볼넷 타자가 주자 목록(종류 2 → 0xa93ac)에 든다', () => {
    const run = applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '볼넷' })
    expect(run.allowed.baserunner).toBe(1)
    expect(run.progress.brokenConditions).toContain('무출루')
    expect(run.status).toBe('실패')
  })

  it('사구도 13·14 번을 깬다 — 판정 4 도 같은 종류 2 (0x3e1b4)', () => {
    expect(applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '사구' }).status).toBe('실패')
    const perfect = applyPitcherOutcome(startPitcherMission(퍼펙트), { kind: '사구' })
    expect(perfect.progress.brokenConditions).toEqual(['무출루'])
    expect(perfect.status).toBe('실패')
  })

  it('삼진·아웃은 출루가 아니다 — 13번은 계속 간다', () => {
    let run = applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '삼진' })
    expect(run.allowed.baserunner).toBe(0)
    run = applyPitcherOutcome(run, { kind: '아웃', detail: '뜬공아웃' })
    expect(run.status).toBe('진행중')
  })

  it('다른 미션은 볼넷 하나로 이 한도에 안 걸린다 (한도 0)', () => {
    const run = applyPitcherOutcome(startPitcherMission(연속삼진쇼), { kind: '볼넷' })
    expect(run.progress.brokenConditions).not.toContain('무출루')
  })
})

/** 진행기가 돌린 결과에서 진루·운명만 바꿔 끼운 플레이 — 원본 목록 순서의 운명을 그대로 먹인다 */
function playedWith(advance: AdvanceResult, runnerFates: readonly RunnerFate[]): DefensePlayResult {
  const base = runDefensePlay(
    missionDefensePlayInputOf({ first: false, second: false, third: false }, 0, { kind: '안타', bases: 1 }),
  )
  return { ...base, advance, runnerFates }
}
const fate = (fromBase: number, scored: boolean, retired: boolean): RunnerFate => ({ fromBase, scored, retired })

describe('R+0x130 — 주자 목록 마지막 원소의 +0x96 (0xa8c5c~0xa8c86)', () => {
  const 노히트노런 = PITCHER_MISSIONS.find((m) => m.id === 13)!
  const EMPTY = { first: false, second: false, third: false }
  const FIRST = { first: true, second: false, third: false }
  const withBases = (bases: typeof EMPTY): PitcherRun => ({ ...startPitcherMission(노히트노런), bases })

  it('빈 루: 타자주자가 루에 남으면 1, 홈런처럼 득점하면 0 (+0x96 이 선다), 땅볼 아웃이면 0', () => {
    expect(applyPitcherOutcome(withBases(EMPTY), { kind: '안타', bases: 1 }).allowed.baserunner).toBe(1)
    expect(applyPitcherOutcome(withBases(EMPTY), { kind: '홈런' }).allowed.baserunner).toBe(0)
    expect(applyPitcherOutcome(withBases(EMPTY), { kind: '아웃', detail: '땅볼아웃' }).allowed.baserunner).toBe(0)
  })

  it('빈 루 삼진은 목록이 비어 0 이다', () => {
    expect(applyPitcherOutcome(withBases(EMPTY), { kind: '삼진' }).allowed.baserunner).toBe(0)
  })

  it('주자가 있으면 맨 앞 주자를 본다 — 삼진으로 남은 1루 주자는 1, 득점하면 0', () => {
    expect(applyPitcherOutcome(withBases(FIRST), { kind: '삼진' }).allowed.baserunner).toBe(1)
    const 득점 = playedWith(
      { bases: FIRST, runsScored: 1, outsAdded: 0 },
      [fate(0, false, false), fate(3, true, true)],
    )
    const run = applyPitcherOutcome(withBases({ ...EMPTY, third: true }), { kind: '안타', bases: 1 }, { played: 득점 })
    expect(run.allowed.baserunner).toBe(0)
  })

  it('앞 주자가 잡히고 뒤 주자가 그 루까지 간 플레이는 0 이다 — 예전 근사("가장 높은 찬 루 ≥ 출발 루")는 1 이었다', () => {
    // 1·2루, 2루 주자가 3루에서 잡히고 1루 주자는 2루, 타자는 1루
    const 앞주자아웃 = playedWith(
      { bases: { first: true, second: true, third: false }, runsScored: 0, outsAdded: 1 },
      [fate(0, false, false), fate(1, false, false), fate(2, false, true)],
    )
    const run = applyPitcherOutcome(
      withBases({ first: true, second: true, third: false }),
      { kind: '안타', bases: 1 },
      { played: 앞주자아웃 },
    )
    expect(run.allowed.baserunner).toBe(0)
  })
})

describe('R+0x128 3아웃 갈래 — 목록 0번이 끝났으면 0, 살았으면 +0x95 수 (0xa8ec0)', () => {
  const 에이스 = PITCHER_MISSIONS.find((m) => m.id === 7)!
  const 두아웃 = (): PitcherRun => ({
    ...startPitcherMission(에이스),
    bases: { first: true, second: false, third: true },
    outs: 2,
  })

  it('타자주자는 살고 다른 주자가 셋째 아웃 — 날아간 보류 득점도 실점이다', () => {
    const played = playedWith(
      { bases: { first: true, second: false, third: false }, runsScored: 0, outsAdded: 1 },
      [fate(0, false, false), fate(1, false, true), fate(3, true, true)],
    )
    const run = applyPitcherOutcome(두아웃(), { kind: '안타', bases: 1 }, { played })
    expect(run.allowed.runs).toBe(1)
    expect(run.progress.brokenConditions).toContain('무실점')
  })

  it('타자주자가 셋째 아웃이면 그 플레이 득점은 하나도 안 센다', () => {
    const played = playedWith(
      { bases: { first: false, second: true, third: false }, runsScored: 0, outsAdded: 1 },
      [fate(0, false, true), fate(1, false, false), fate(3, true, true)],
    )
    const run = applyPitcherOutcome(두아웃(), { kind: '아웃', detail: '땅볼아웃' }, { played })
    expect(run.allowed.runs).toBe(0)
  })
})

describe('실점 한도 +0xa1 ↔ R+0x128 — 정산 0xa8f56 이 득점 주자마다 직접 올린다', () => {
  it('투수 7번(실점 한도 1, 피안타 한도 0)은 솔로 홈런 하나로 무실점이 깨져 실패다', () => {
    const 에이스 = PITCHER_MISSIONS.find((m) => m.id === 7)!
    expect(에이스.failLimits).toMatchObject({ runs: 1, hits: 0 })

    const run = applyPitcherOutcome(startPitcherMission(에이스), { kind: '홈런' })
    expect(run.allowed.runs).toBe(1)
    expect(run.progress.brokenConditions).toEqual(['무실점'])
    expect(run.status).toBe('실패')
  })
})
