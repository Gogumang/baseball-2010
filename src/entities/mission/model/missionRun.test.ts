import { describe, expect, it } from 'vitest'
import { applyOutcome, giveUp, missionAdvance, startMission, tick } from '@/entities/mission/model/missionRun'
import { MISSIONS } from '@/shared/config/original/missions'

const 첫걸음 = MISSIONS.find((m) => m.name === '명품 타자의 첫 걸음')!
const 사이클링 = MISSIONS.find((m) => m.name.includes('사이클링'))!
const 치명적인유혹 = MISSIONS.find((m) => m.name === '치명적인 유혹')!
const 추격타 = MISSIONS.find((m) => m.name === '추격타의 주인공')!

describe('타석 제한 — 원본 레코드 값이 설명문과 같다', () => {
  it('"3타석 내에 2안타를 날려라!" 에서 3을 읽는다', () => {
    expect(startMission(치명적인유혹).remainingPlateAppearances).toBe(3)
  })

  it('"2타석 내에 홈런을 날려라!" 에서 2를 읽는다', () => {
    expect(startMission(추격타).remainingPlateAppearances).toBe(2)
  })

  it('제한이 없는 미션은 null이다', () => {
    expect(startMission(첫걸음).remainingPlateAppearances).toBeNull()
  })
})

describe('startMission', () => {
  it('제한 시간이 있는 미션은 남은 시간이 설정된다', () => {
    const run = startMission(사이클링)

    expect(run.remainingSeconds).toBe(사이클링.timeLimitSeconds)
    expect(run.status).toBe('진행중')
  })

  it('제한 시간이 없으면 null이다', () => {
    expect(startMission(첫걸음).remainingSeconds).toBeNull()
  })
})

describe('applyOutcome', () => {
  it('목표를 다 채우면 즉시 성공이다', () => {
    let run = startMission(첫걸음)
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    expect(run.status).toBe('진행중')

    run = applyOutcome(run, { kind: '안타', bases: 1 })

    expect(run.status).toBe('성공')
  })

  it('타석 제한을 다 쓰고 목표를 못 채우면 실패다', () => {
    let run = startMission(추격타)

    run = applyOutcome(run, { kind: '삼진' })
    expect(run.status).toBe('진행중')
    run = applyOutcome(run, { kind: '삼진' })

    expect(run.status).toBe('실패')
  })

  it('마지막 타석에 목표를 채우면 실패가 아니라 성공이다', () => {
    let run = startMission(추격타)

    run = applyOutcome(run, { kind: '삼진' })
    run = applyOutcome(run, { kind: '홈런' })

    expect(run.status).toBe('성공')
  })

  it('끝난 미션은 더 이상 바뀌지 않는다', () => {
    let run = startMission(첫걸음)
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    run = applyOutcome(run, { kind: '안타', bases: 1 })
    expect(run.status).toBe('성공')

    expect(applyOutcome(run, { kind: '삼진' })).toBe(run)
  })

  it('입력 상태를 변경하지 않는다', () => {
    const before = startMission(첫걸음)

    applyOutcome(before, { kind: '홈런' })

    expect(before.progress.plateAppearances).toBe(0)
  })
})

/**
 * 미션도 사람이 치는 타석이라 원본은 간이 엔진이 아니라 **수비 시뮬레이션**을 돌린다
 * (0xae24c·0xae3e8). 태그업 0xa9620 → 자동 진루 0xaf918("송구보다 2틱 이상 빠를 때만")
 * → 2아웃 득점 보류 순서다 (P2 7절 표 · U-02).
 *
 * 아래 값은 `runDefensePlay` 가 실제로 돌려준 것을 그대로 못 박은 것이다 — 난수를 넘기지
 * 않으므로 결정론이다.
 */
describe('missionAdvance — 미션 주루도 수비 시뮬레이션이 정한다 (P2 7절 · U-02)', () => {
  const 주자 = (first: boolean, second: boolean, third: boolean) => ({ first, second, third })

  it('1루타에 2루 주자가 홈까지 온다 — "1루타면 3루 주자만 득점" 고정표가 아니다', () => {
    expect(missionAdvance(주자(false, true, false), 0, { kind: '안타', bases: 1 })).toEqual({
      bases: 주자(true, false, false),
      runsScored: 1,
      outsAdded: 0,
    })
  })

  it('1루타에 1루 주자가 3루까지 간다 (0xaf918 자동 추가 진루)', () => {
    expect(missionAdvance(주자(true, false, false), 0, { kind: '안타', bases: 1 })).toEqual({
      bases: 주자(true, false, true),
      runsScored: 0,
      outsAdded: 0,
    })
  })

  it('2아웃이면 득점이 보류된다 — 3루 주자 뜬공에 점수가 없다', () => {
    const 뜬공 = { kind: '아웃', detail: '뜬공아웃' } as const
    expect(missionAdvance(주자(false, false, true), 1, 뜬공).runsScored).toBe(1)
    expect(missionAdvance(주자(false, false, true), 2, 뜬공).runsScored).toBe(0)
  })

  it('3루 주자 땅볼은 병살이 되고 점수가 없다 — 희생플라이 보장 근사가 사라졌다', () => {
    expect(missionAdvance(주자(false, false, true), 0, { kind: '아웃', detail: '땅볼아웃' })).toEqual({
      bases: 주자(false, false, false),
      runsScored: 0,
      outsAdded: 2,
    })
  })

  it('삼진·볼넷·홈런은 수비가 개입할 것이 없어 예전 길 그대로다', () => {
    expect(missionAdvance(주자(false, true, false), 0, { kind: '삼진' })).toEqual({
      bases: 주자(false, true, false),
      runsScored: 0,
      outsAdded: 1,
    })
    expect(missionAdvance(주자(false, true, false), 0, { kind: '홈런' })).toEqual({
      bases: 주자(false, false, false),
      runsScored: 2,
      outsAdded: 0,
    })
  })

  it('미션 진행에도 이어져 있다 — 1루 주자가 단타에 3루까지 간다', () => {
    // 고정 진루표였다면 1루 주자는 2루까지만 갔다
    const 방망이 = MISSIONS.find((m) => m.name === '폭발하는 방망이')!
    const run = applyOutcome(startMission(방망이), { kind: '안타', bases: 1 })

    expect(run.bases).toEqual({ first: true, second: false, third: true })
  })
})

describe('tick — 제한 시간', () => {
  it('시간이 줄어든다', () => {
    const run = tick(startMission(사이클링), 10)

    expect(run.remainingSeconds).toBe(사이클링.timeLimitSeconds - 10)
    expect(run.status).toBe('진행중')
  })

  it('시간이 다 되면 실패다', () => {
    const run = tick(startMission(사이클링), 사이클링.timeLimitSeconds)

    expect(run.remainingSeconds).toBe(0)
    expect(run.status).toBe('실패')
  })

  it('제한 시간이 없는 미션은 시간이 흘러도 그대로다', () => {
    const run = startMission(첫걸음)

    expect(tick(run, 9999)).toBe(run)
  })

  it('이미 성공한 미션은 시간이 지나도 실패로 바뀌지 않는다', () => {
    const run = { ...startMission(사이클링), status: '성공' as const }

    expect(tick(run, 9999).status).toBe('성공')
  })
})

describe('giveUp', () => {
  it('진행 중이면 실패로 바꾼다', () => {
    expect(giveUp(startMission(첫걸음)).status).toBe('실패')
  })

  it('이미 끝났으면 그대로 둔다', () => {
    const 성공 = { ...startMission(첫걸음), status: '성공' as const }

    expect(giveUp(성공)).toBe(성공)
  })
})
