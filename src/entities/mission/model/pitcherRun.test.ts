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

  it('볼넷은 노히트노런을 깨지 않는다', () => {
    let run = startPitcherMission(노히트노런)

    run = applyPitcherOutcome(run, { kind: '볼넷' })

    expect(run.status).toBe('진행중')
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
