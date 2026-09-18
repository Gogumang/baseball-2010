import { describe, expect, it } from 'vitest'
import { applyOutcome, giveUp, startMission, tick } from '@/entities/mission/model/missionRun'
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
