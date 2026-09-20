import { describe, expect, it } from 'vitest'
import {
  applyDerbyPitch,
  createDerbyRun,
  derbyBallCountOf,
  derbyBallNumberOf,
  derbyResultOf,
} from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyPitchOutcome, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'

const 헛스윙: DerbyPitchOutcome = { isHomeRun: false, distance: 0, isEventZoneHit: false }
const 홈런 = (distance: number): DerbyPitchOutcome => ({ isHomeRun: true, distance, isEventZoneHit: false })
const 존적중: DerbyPitchOutcome = { isHomeRun: false, distance: 0, isEventZoneHit: true }

const 여러번 = (run: DerbyRun, outcomes: readonly DerbyPitchOutcome[]): DerbyRun =>
  outcomes.reduce(applyDerbyPitch, run)

describe('초기화 0xb6814', () => {
  it('기회 10, 단계 0, 보너스 G 0 으로 시작한다', () => {
    const run = createDerbyRun()
    expect(run.remainingPitches).toBe(10)
    expect(run.stage).toBe(0)
    expect(run.bonusGamePoint).toBe(0)
    expect(run.maxCombo).toBe(0)
    expect(run.isBonusGame).toBe(false)
    expect(run.isFinished).toBe(false)
  })
})

describe('누적 비거리는 홈런일 때만 쌓인다', () => {
  it('홈런이 아니면 그대로다', () => {
    expect(applyDerbyPitch(createDerbyRun(), 헛스윙).totalDistance).toBe(0)
  })

  it('홈런이면 그 타구의 비거리가 더해진다', () => {
    const run = 여러번(createDerbyRun(), [홈런(90), 홈런(100)])
    expect(run.totalDistance).toBe(190)
    expect(run.lastDistance).toBe(100)
  })
})

describe('콤보 — 직전 공과 이번 공이 모두 홈런일 때만 오른다, 보너스 G += 콤보 × 5', () => {
  it('첫 홈런은 아직 콤보가 아니다', () => {
    expect(applyDerbyPitch(createDerbyRun(), 홈런(90)).combo).toBe(0)
  })

  it('연속 홈런 두 개에서 콤보 1, 보너스 G 5', () => {
    const run = 여러번(createDerbyRun(), [홈런(90), 홈런(90)])
    expect(run.combo).toBe(1)
    expect(run.maxCombo).toBe(1)
    expect(run.bonusGamePoint).toBe(5)
  })

  it('세 개 연속이면 콤보 2, 보너스 G 는 5 + 10 = 15', () => {
    const run = 여러번(createDerbyRun(), [홈런(90), 홈런(90), 홈런(90)])
    expect(run.combo).toBe(2)
    expect(run.maxCombo).toBe(2)
    expect(run.bonusGamePoint).toBe(15)
  })

  it('중간에 끊기면 콤보는 0 으로 돌아가지만 최대 콤보는 남는다', () => {
    const run = 여러번(createDerbyRun(), [홈런(90), 홈런(90), 헛스윙])
    expect(run.combo).toBe(0)
    expect(run.maxCombo).toBe(1)
  })

  it('⚠️ 원본 그대로 — 마지막(10번째) 공은 홈런이어도 콤보가 안 붙는다', () => {
    // 아홉 번째까지 홈런을 치고 열 번째도 홈런: 콤보는 8 까지만 오른다
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 홈런(90)))
    expect(run.maxCombo).toBe(8)
  })
})

describe('이벤트 존 — 적중하면 보너스 G += 200', () => {
  it('한 번 적중에 200', () => {
    expect(applyDerbyPitch(createDerbyRun(), 존적중).bonusGamePoint).toBe(200)
  })

  it('콤보 보너스와 같이 붙는다', () => {
    const run = 여러번(createDerbyRun(), [홈런(90), { isHomeRun: true, distance: 90, isEventZoneHit: true }])
    expect(run.bonusGamePoint).toBe(5 + 200)
  })
})

describe('기회와 던진 공 수', () => {
  it('열 번 치면 남은 기회가 1 에서 멈추고 판이 끝난다 (콤보가 없을 때)', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 헛스윙))
    expect(run.remainingPitches).toBe(1)
    expect(run.isFinished).toBe(true)
  })

  it('⚠️ 원본 그대로 — 던진 공 수(+0x68)는 마지막 공을 안 세어 9 에서 멈춘다', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 헛스윙))
    expect(run.pitchesThrown).toBe(9)
  })

  it('끝난 뒤에는 더 이상 바뀌지 않는다', () => {
    const 끝난판 = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 헛스윙))
    expect(applyDerbyPitch(끝난판, 홈런(160))).toBe(끝난판)
  })
})

describe('단계는 공이 끝날 때 누적 비거리로 오른다', () => {
  it('누적 800 을 넘기면 단계 1 이 된다', () => {
    // 100 씩 여덟 번 = 800
    const run = 여러번(createDerbyRun(), Array.from({ length: 8 }, () => 홈런(100)))
    expect(run.totalDistance).toBe(800)
    expect(run.stage).toBe(1)
  })

  it('마지막 공에서 문턱을 넘으면 단계가 안 오른다 — 2번 항은 기회가 남았을 때만 돈다', () => {
    const outcomes = [
      ...Array.from({ length: 9 }, () => 홈런(100)),
      홈런(100),
    ]
    const run = 여러번(createDerbyRun(), outcomes)
    // 아홉 번째 공까지 누적 900 → 단계 1. 열 번째에서 1000 이 돼도 단계는 그대로다
    expect(run.totalDistance).toBe(1_000)
    expect(run.stage).toBe(1)
  })
})

describe('보너스 게임 — 최대 콤보 수만큼, 한 번만', () => {
  it('최대 콤보가 0 이면 그냥 끝난다', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 헛스윙))
    expect(run.isBonusGame).toBe(false)
    expect(run.isFinished).toBe(true)
  })

  it('최대 콤보가 있으면 그 수만큼 기회를 더 준다', () => {
    // 홈런 세 개(콤보 2) 뒤 일곱 번 헛스윙 = 10 구
    const 열구 = [홈런(90), 홈런(90), 홈런(90), ...Array.from({ length: 7 }, () => 헛스윙)]
    const run = 여러번(createDerbyRun(), 열구)
    expect(run.maxCombo).toBe(2)
    expect(run.isBonusGame).toBe(true)
    expect(run.isFinished).toBe(false)
    expect(run.remainingPitches).toBe(2)
  })

  it('보너스 게임을 다 쓰면 끝나고, 두 번째 보너스는 없다', () => {
    const 열구 = [홈런(90), 홈런(90), 홈런(90), ...Array.from({ length: 7 }, () => 헛스윙)]
    const run = 여러번(createDerbyRun(), [...열구, 헛스윙, 헛스윙])
    expect(run.isFinished).toBe(true)
    expect(run.isBonusGame).toBe(true)
  })
})

describe('HUD 공 번호 = (보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1', () => {
  it('첫 공은 1, 열째 공은 10 이다', () => {
    let run = createDerbyRun()
    expect(derbyBallNumberOf(run)).toBe(1)
    for (let index = 0; index < 9; index += 1) run = applyDerbyPitch(run, 헛스윙)
    expect(run.remainingPitches).toBe(1)
    expect(derbyBallNumberOf(run)).toBe(10)
  })

  it('보너스 게임에서는 최대 콤보를 기준으로 다시 1 부터 센다', () => {
    const 열구 = [홈런(90), 홈런(90), 홈런(90), ...Array.from({ length: 7 }, () => 헛스윙)]
    const run = 여러번(createDerbyRun(), 열구)
    expect(derbyBallCountOf(run)).toBe(2)
    expect(derbyBallNumberOf(run)).toBe(1)
    expect(derbyBallNumberOf(applyDerbyPitch(run, 헛스윙))).toBe(2)
  })
})

describe('결과 정산 (0x4f574)', () => {
  it('총 기회 = 10, 보너스를 했으면 10 + 최대 콤보', () => {
    const 보너스없음 = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 헛스윙))
    expect(derbyResultOf(보너스없음, 0).pitchCount).toBe(10)

    const 열구 = [홈런(90), 홈런(90), 홈런(90), ...Array.from({ length: 7 }, () => 헛스윙)]
    const 보너스 = 여러번(createDerbyRun(), [...열구, 헛스윙, 헛스윙])
    expect(derbyResultOf(보너스, 0).pitchCount).toBe(12)
  })

  it('누적이 최고 기록을 넘으면 갈아 끼우고 신기록이 된다', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 홈런(50)))
    const result = derbyResultOf(run, 300)
    expect(result.totalDistance).toBe(500)
    expect(result.isNewRecord).toBe(true)
    expect(result.bestDistance).toBe(500)
  })

  it('같거나 낮으면 기록이 그대로다', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 홈런(50)))
    const result = derbyResultOf(run, 500)
    expect(result.isNewRecord).toBe(false)
    expect(result.bestDistance).toBe(500)
  })

  it('획득 G 는 (누적/100) × 배율[단계] + 보너스 G 다', () => {
    const run = 여러번(createDerbyRun(), Array.from({ length: 10 }, () => 홈런(100)))
    // 누적 1000, 단계 1(누적 800 에서 올라감), 콤보 보너스 = 1+2+…+8 배 5
    const 콤보보너스 = ((8 * 9) / 2) * 5
    expect(run.stage).toBe(1)
    expect(run.bonusGamePoint).toBe(콤보보너스)
    expect(derbyResultOf(run, 0).gainedGamePoint).toBe(10 * 2 + 콤보보너스)
  })
})
