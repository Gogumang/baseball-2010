import { describe, expect, it } from 'vitest'
import { registerContact } from '@/entities/batting/model/battedContact'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/** 타석 판정이 쏜 패턴을 묶은 결과 — 진행기가 그 패턴으로 판을 돌리고 기록은 판 끝 정산 결과다(`battedContact`) */
const 쏜공 = (outcome: AtBatOutcome, pattern: BattedBallPattern, resultCode: number): AtBatOutcome =>
  registerContact(outcome, { pattern, resultCode })
/** 원본 코드 2 [47, 1038, 596] — 1루 쪽 깊숙이 떨어져 우익수가 20틱에 줍는 단타 */
const 깊은단타 = (): AtBatOutcome => 쏜공({ kind: '안타', bases: 1 }, [47, 1038, 596, 0], 2)
/** 원본 코드 0 [0] [90, 810, 1592] — 중견수가 뜬 채로 잡는다(키 없는 사람 수비도 쥐기만 하면 뜬공 아웃이다) */
const 잡히는뜬공 = (): AtBatOutcome => 쏜공({ kind: '아웃', detail: '뜬공아웃' }, [90, 810, 1592, 0], 0)
/** 내야 뒤에 겨우 뜬 공 — 뜬 채로 잡히고 3루 주자는 태그업으로 못 들어온다 */
const 얕은뜬공 = (): AtBatOutcome => 쏜공({ kind: '아웃', detail: '뜬공아웃' }, [90, 250, 700, 0], 0)
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  recordPitch,
  startPitcherMission,
  inningGoalOf,
  OUTS_PER_INNING,
  runPitcherMissionAutoHalves,
} from '@/entities/mission/model/pitcherRun'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { MISSIONS } from '@/shared/config/original/missions'
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

  /**
   * 원본 판정 0xaaa6c aac48 — 실점 · 피안타 · 출루 허용 한도가 모두 선 미션은 **경기가 끝나야**(0xb68fc) 성공이다. 이닝 수를 세지 않는다.
   * 13번은 사람 칸(홈)이 2-0 으로 앞선 5회초부터 — 사람 칸 팀이 치는 말은 자동진행(간이 엔진)이 돌고, 9회초 3아웃에 홈이 앞서 있어 끝난다.
   */
  it('사람이 막는 반 이닝마다 자동진행이 말을 돌리고, 9회초 3아웃에 경기가 끝나며 성공이다', () => {
    const random = createSeededRandom(3)
    let run = startPitcherMission(노히트노런)
    for (let i = 0; i < 5 * OUTS_PER_INNING - 1; i += 1) {
      run = runPitcherMissionAutoHalves(applyPitcherOutcome(run, { kind: '삼진' }), random)
      expect(run.status, `${i + 1}번째 아웃`).toBe('진행중')
    }
    // 4회말 · … · 8회말을 지나 9회초 — 이닝 st[0x6b] 는 0부터 8
    expect(run.game).toMatchObject({ inning: 8, offenseSide: 0 })
    expect(run.game.scores[1]).toBeGreaterThanOrEqual(2)

    run = applyPitcherOutcome(run, { kind: '삼진' })

    expect(run.totalOuts).toBe(15)
    expect(run.status).toBe('성공')
  })

  it('3아웃이면 0x18 을 기다린다 — 자동진행 반 이닝을 돌린 뒤 다음 이닝 빈 루 · 0아웃', () => {
    let run = startPitcherMission(노히트노런)
    for (let i = 0; i < OUTS_PER_INNING; i += 1) run = applyPitcherOutcome(run, { kind: '삼진' })
    expect(run.game.halfEnded).toBe(true)
    expect(run.game).toMatchObject({ inning: 4, offenseSide: 0 })

    const after = runPitcherMissionAutoHalves(run, createSeededRandom(3))
    expect(after.game).toMatchObject({ inning: 5, offenseSide: 0, halfEnded: false })
    expect(after.outs).toBe(0)
    expect(after.bases).toEqual({ first: false, second: false, third: false })
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

  it('아웃만 쌓이면 퍼펙트게임도 성공한다 — 9회초 3아웃 경기 끝', () => {
    const random = createSeededRandom(5)
    let run = startPitcherMission(퍼펙트)
    // 사람 수비 · 송구 기본 수동이라 키 없이는 땅볼에 아무도 안 던진다(0xb1c90) — 뜬 채로 잡히는 공으로 아웃을 쌓는다
    for (let i = 0; i < 6 * OUTS_PER_INNING; i += 1) {
      run = runPitcherMissionAutoHalves(applyPitcherOutcome(run, 잡히는뜬공()), random)
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

  it('2루 주자가 있는 단타 — 수비 진행기가 정한다: 키 없는 사람 수비는 안 던지고 2루 주자는 홈까지 간다', () => {
    expect(사우팅.start.runners).toEqual({ first: false, second: true, third: false })

    const run = applyPitcherOutcome(startPitcherMission(사우팅), 깊은단타())

    // 투수편은 사람 수비 · 송구 설정 기본 수동 — 원본은 키가 없으면 아무도 던지지 않는다(0xb1c90 자동 가지에
    // 송구 호출이 없다). 이 단타(원본 코드 2 [47, 1038, 596])는 원본 궤적(세계 0xbfed0)으로 1루 쪽 깊숙이
    // 떨어져 우익수(6)가 20틱에 줍는다 — 그 자리에서 홈까지의 수비 틱 예측(0xaf284)보다 주자가 빨라
    // 자동 진루 0xaf918 이 2루 주자를 홈까지 보낸다.
    expect(run.allowed.runs).toBe(1)
    expect(run.bases).toEqual({ first: true, second: false, third: false })
  })

  it('1·3루 얕은 뜬공 — 판 시작 리드(0x3d7b8) 뒤로 아웃 하나, 3루 주자는 못 들어온다', () => {
    const 챔피언 = PITCHER_MISSIONS.find((m) => m.name === '최강의 챔피언')!
    expect(챔피언.start.runners).toEqual({ first: true, second: false, third: true })

    // 사람 수비 · 키 없음이라 땅볼에는 아무도 안 던진다 — 뜬 채로 잡히는 얕은 공으로 본다
    const run = applyPitcherOutcome(startPitcherMission(챔피언), 얕은뜬공())

    expect(run.totalOuts).toBe(1)
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

  it('빈 루: 타자주자가 루에 남으면 1, 홈런처럼 득점하면 0 (+0x96 이 선다), 아웃이면 0', () => {
    expect(applyPitcherOutcome(withBases(EMPTY), 깊은단타()).allowed.baserunner).toBe(1)
    expect(applyPitcherOutcome(withBases(EMPTY), { kind: '홈런' }).allowed.baserunner).toBe(0)
    expect(applyPitcherOutcome(withBases(EMPTY), 잡히는뜬공()).allowed.baserunner).toBe(0)
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

describe("'아웃'(R+0x13c)은 아웃 콜마다 1 — 삼진 0xa7c4c · 아웃 콜 0xa7d0c(a7d52)", () => {
  // 투수 5번 "흔들리지 않는 마음" — 목표 '아웃' 3, 2루 주자, 0아웃
  const 흔들리지않는 = PITCHER_MISSIONS.find((m) => m.id === 5)!
  const 일이루 = (outs: number): PitcherRun => ({
    ...startPitcherMission(흔들리지않는),
    bases: { first: true, second: true, third: false },
    outs,
  })

  it('병살 플레이는 아웃 2 — 결과 하나당 1 이 아니다', () => {
    const 병살 = playedWith(
      { bases: { first: false, second: false, third: true }, runsScored: 0, outsAdded: 2 },
      [fate(0, false, true), fate(1, false, true), fate(2, false, false)],
    )
    const run = applyPitcherOutcome(일이루(0), { kind: '아웃', detail: '땅볼아웃' }, { played: 병살 })
    expect(run.progress.counts['아웃']).toBe(2)
    expect(run.totalOuts).toBe(2)
    expect(run.status).toBe('진행중')
  })

  it('삼중살이면 3 — 목표 3 을 한 판에 채워 성공이다', () => {
    const 삼중살 = playedWith(
      { bases: { first: false, second: false, third: false }, runsScored: 0, outsAdded: 3 },
      [fate(0, false, true), fate(1, false, true), fate(2, false, true)],
    )
    const run = applyPitcherOutcome(일이루(0), { kind: '아웃', detail: '땅볼아웃' }, { played: 삼중살 })
    expect(run.progress.counts['아웃']).toBe(3)
    expect(run.status).toBe('성공')
  })

  it('안타 판에서 주자가 잡혀도 아웃 콜이 나 1 이 든다', () => {
    const 주자아웃 = playedWith(
      { bases: { first: true, second: true, third: false }, runsScored: 0, outsAdded: 1 },
      [fate(0, false, false), fate(1, false, false), fate(2, false, true)],
    )
    const run = applyPitcherOutcome(일이루(0), { kind: '안타', bases: 1 }, { played: 주자아웃 })
    expect(run.progress.counts['아웃']).toBe(1)
  })

  it('판은 셋째 아웃에서 끝난다 — 2아웃 병살은 1 만 든다', () => {
    const 병살 = playedWith(
      { bases: { first: false, second: false, third: false }, runsScored: 0, outsAdded: 2 },
      [fate(0, false, true), fate(1, false, true), fate(2, false, false)],
    )
    const run = applyPitcherOutcome(일이루(2), { kind: '아웃', detail: '땅볼아웃' }, { played: 병살 })
    expect(run.progress.counts['아웃']).toBe(1)
  })

  it('삼진은 1 (0xa7c4c a7cc4)', () => {
    const run = applyPitcherOutcome(일이루(0), { kind: '삼진' })
    expect(run.progress.counts['아웃']).toBe(1)
  })
})

describe('투수 미션의 이닝 넘김 — 0x18 · 자동진행 · 0xaae7c (`runPitcherMissionAutoHalves`)', () => {
  const 미션 = (id: number) => MISSIONS.find((mission) => mission.side === '투수' && mission.id === id)!

  it('새 이닝 첫 0xd 의 0xaae7c 가 지금 타순 레코드에 마타자를 다시 끼운다 — 그 칸 필살 남은 칸은 −1', () => {
    // 로제(18) — 1회말 CPU 공격, 마타자는 시작 타순 3
    const started = startPitcherMission(미션(18))
    const batting = started.cpu.batting!
    const moved: PitcherRun = {
      ...started,
      cpu: { ...started.cpu, batting: { ...batting, order: 5, specialSwing: { 5: 2 } } },
      game: { ...started.game, halfEnded: true },
    }
    const after = runPitcherMissionAutoHalves(moved, createSeededRandom(2))
    expect(after.game).toMatchObject({ inning: 1, offenseSide: 1, aceCheckedInning: 1 })
    expect(after.cpu.batting?.records[5]).toBe(-1)
    expect(after.cpu.batting?.records[9]).toBe(5)
    // 처음 끼운 마타자(레코드 3)는 그대로 — 둘이 된다
    expect(after.cpu.batting?.records[3]).toBe(-1)
    expect(after.cpu.batting?.specialSwing[5]).toBeUndefined()
  })

  it('마타자가 아닌 미션은 끼우지 않는다', () => {
    const started = startPitcherMission(미션(2))
    const after = runPitcherMissionAutoHalves({ ...started, game: { ...started.game, halfEnded: true } }, createSeededRandom(2))
    expect(after.cpu.batting?.records).toEqual(started.cpu.batting?.records)
    expect(after.game.aceCheckedInning).toBe(-1)
  })

  it('9회초 3아웃에 사람 칸(홈)이 앞서 경기가 끝나면 목표가 덜 찼어도 실패다 — 0xaaa6c aad20', () => {
    // 깔끔한 마무리(1) — 9회초, 사람 칸 홈. 목표(아웃 · 탈삼진)를 다 못 채운 채 3아웃
    let run = startPitcherMission(미션(1))
    run = applyPitcherOutcome(run, 잡히는뜬공())
    run = applyPitcherOutcome(run, 잡히는뜬공())
    expect(run.status).toBe('진행중')
    // 홈 3 : 원정 1
    expect(run.game.scores).toEqual([1, 3])
    run = applyPitcherOutcome(run, 잡히는뜬공())
    expect(run.status).toBe('실패')
  })
})
