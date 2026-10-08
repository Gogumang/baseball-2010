import { describe, expect, it } from 'vitest'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import { basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { createRunner, NONE, type RunnerState } from '@/entities/fielding/model/fieldingState'
import {
  eventCodeEffectOf,
  isFoulEnded,
  liveRunnerCountOf,
  passPlayGate,
  passPlayGateBetweenTicks,
  playEndResultCode,
  PLAY_END_COUNT_LIMIT,
  someRunnerStillActive,
  strikesAfterPlay,
  type PlayEndState,
  type PlayGateInput,
} from '@/entities/fielding/model/playGate'

const 페어낙구: PlayEndState = {
  flyOut: false,
  specialEvent: false,
  foulAngle: false,
  strikes: 0,
  buntKind: 0,
  poleTick: -1,
  fenceTick: -1,
  ballTouched: true,
}

describe('판 끝 결과 코드 0x9d5bc · 파울 판정 0xb68dc', () => {
  it('뜬공 아웃(state[0x1f])이 가장 먼저 — 13', () => {
    expect(playEndResultCode({ ...페어낙구, flyOut: true, foulAngle: true })).toBe(13)
  })

  it('0.1% 사건(state[0x19])이면 0 — 파울·담장도 안 본다', () => {
    expect(playEndResultCode({ ...페어낙구, specialEvent: true, foulAngle: true, fenceTick: 30 })).toBe(0)
  })

  it('파울이면 7, 2스트라이크 번트 파울이면 11 (9d5e2~9d600)', () => {
    expect(playEndResultCode({ ...페어낙구, foulAngle: true })).toBe(7)
    expect(playEndResultCode({ ...페어낙구, foulAngle: true, strikes: 2, buntKind: 1 })).toBe(11)
    // 1스트라이크 번트 파울은 그냥 파울
    expect(playEndResultCode({ ...페어낙구, foulAngle: true, strikes: 1, buntKind: 1 })).toBe(7)
  })

  it('0xb68dc — 뜬공 포구 · (사건 && 2스트라이크) 이면 파울이 아니다', () => {
    expect(isFoulEnded({ ...페어낙구, foulAngle: true, flyOut: true })).toBe(false)
    expect(isFoulEnded({ ...페어낙구, foulAngle: true, specialEvent: true, strikes: 2 })).toBe(false)
    expect(isFoulEnded({ ...페어낙구, foulAngle: true, specialEvent: true, strikes: 1 })).toBe(true)
  })

  it('폴(state[0x80]) — 땅에 닿았고 담장 틱이 있으면 10, 아니면 12', () => {
    expect(playEndResultCode({ ...페어낙구, poleTick: 30, fenceTick: 30, ballTouched: true })).toBe(10)
    expect(playEndResultCode({ ...페어낙구, poleTick: 30, fenceTick: 30, ballTouched: false })).toBe(12)
    expect(playEndResultCode({ ...페어낙구, poleTick: 30, fenceTick: -1, ballTouched: true })).toBe(12)
  })

  it('담장선(state[0x20]) — 바운드 뒤면 10(그라운드 룰 2루타), 뜬 채면 8(홈런)', () => {
    expect(playEndResultCode({ ...페어낙구, fenceTick: 30, ballTouched: true })).toBe(10)
    expect(playEndResultCode({ ...페어낙구, fenceTick: 30, ballTouched: false })).toBe(8)
  })

  it('그 밖 — 6', () => {
    expect(playEndResultCode(페어낙구)).toBe(6)
  })
})

describe('사건 코드 처리 0xb2bc4 (표 0xd87a0)', () => {
  it('7 파울 +0x110 · 8 홈런 +0x111 · 종류 6 · 10 +0x124 · 종류 7 · 11 vt90 · 12 +0x129 · 종류 0xa', () => {
    expect(eventCodeEffectOf(7)).toMatchObject({ foulFlag: true, playKind: -1 })
    expect(eventCodeEffectOf(8)).toMatchObject({ homeRunFlag: true, playKind: 6 })
    expect(eventCodeEffectOf(10)).toMatchObject({ groundRuleFlag: true, playKind: 7 })
    expect(eventCodeEffectOf(11)).toMatchObject({ judgeOut: true, playKind: -1 })
    expect(eventCodeEffectOf(12)).toMatchObject({ poleHomeRunFlag: true, playKind: 0xa })
  })

  it('6 · 9 · 13 은 아무것도 안 세운다 (b2c3e)', () => {
    for (const code of [6, 9, 13]) {
      expect(eventCodeEffectOf(code)).toEqual({
        foulFlag: false,
        homeRunFlag: false,
        groundRuleFlag: false,
        poleHomeRunFlag: false,
        judgeOut: false,
        playKind: -1,
      })
    }
  })
})

const 닫힘없음: PlayGateInput = {
  foulFlag: false,
  lastEventCode: 0,
  outs: 0,
  someRunnerActive: false,
  homeRunDerby: false,
  homeRunFlag: false,
  poleHomeRunFlag: false,
  liveRunnerCount: 1,
  ballHeld: false,
  groundRuleFlag: false,
  endCounter: 0,
}

describe('판 진행 관문 0xb0d28', () => {
  it('사건 코드 11 · 3아웃이면 곧바로 닫는다 (b0db4 · b0dbe) — 주자가 뛰는 중이어도', () => {
    expect(passPlayGate({ ...닫힘없음, lastEventCode: 11, someRunnerActive: true }).open).toBe(false)
    expect(passPlayGate({ ...닫힘없음, outs: 3, someRunnerActive: true }).open).toBe(false)
    expect(passPlayGate({ ...닫힘없음, outs: 2, someRunnerActive: true }).open).toBe(true)
  })

  it('처리 안 끝난 주자가 있으면 +0x120 = 0 으로 이어진다 (b0dc6)', () => {
    expect(passPlayGate({ ...닫힘없음, someRunnerActive: true, ballHeld: true, endCounter: 40 })).toEqual({
      open: true,
      endCounter: 0,
    })
  })

  it('아무도 안 쥐고 +0x124 도 없으면 세지 않고 이어진다 (b0e24)', () => {
    expect(passPlayGate({ ...닫힘없음, endCounter: 40 })).toEqual({ open: true, endCounter: 0 })
  })

  it('쥔 채(또는 +0x124) 주자가 다 서면 51틱 돌고 52번째 관문에서 닫는다 (b0e46 `old > 50`)', () => {
    for (const extra of [{ ballHeld: true }, { groundRuleFlag: true }]) {
      let counter = 0
      let openTicks = 0
      for (;;) {
        const gate = passPlayGate({ ...닫힘없음, ...extra, endCounter: counter })
        counter = gate.endCounter
        if (!gate.open) break
        openTicks += 1
      }
      expect(openTicks).toBe(PLAY_END_COUNT_LIMIT + 1)
      // b0e50 은 비교 전에 old + 1 을 적는다 — 닫는 관문에서도 하나 오른다
      expect(counter).toBe(PLAY_END_COUNT_LIMIT + 2)
    }
  })

  it('한 그림 사이 관문은 그리기 G3 · 0x3f378 G4(안 쥐었을 때만) · 0x3f060 G1 · 52502 G2 — 쥐면 3, +0x124 만 서면 4 씩 오른다', () => {
    expect(passPlayGateBetweenTicks({ ...닫힘없음, ballHeld: true, endCounter: 0 })).toEqual({
      open: true,
      endCounter: 3,
      drawOpen: true,
    })
    expect(passPlayGateBetweenTicks({ ...닫힘없음, groundRuleFlag: true, endCounter: 0 })).toEqual({
      open: true,
      endCounter: 4,
      drawOpen: true,
    })
    // 건너뛰기(+0xfe7) 동안은 52b32 의 0x3f060(G1) · 524f8 의 G2 둘뿐이고 그리기가 없다
    expect(passPlayGateBetweenTicks({ ...닫힘없음, ballHeld: true, endCounter: 0 }, true)).toEqual({
      open: true,
      endCounter: 2,
      drawOpen: null,
    })
  })

  it('쥔 채 주자가 다 서면 틱 끝마다 세 번 — 17틱 열리고 18번째 틱 끝 G3(old 51)부터 닫는다', () => {
    let counter = 0
    let openTicks = 0
    let lastDraw: boolean | null = null
    for (;;) {
      const gate = passPlayGateBetweenTicks({ ...닫힘없음, ballHeld: true, endCounter: counter })
      counter = gate.endCounter
      lastDraw = gate.drawOpen
      if (!gate.open) break
      openTicks += 1
    }
    expect(openTicks).toBe(17)
    expect(counter).toBe(54)
    expect(lastDraw).toBe(false)
  })

  it('+0x111 · +0x129(홈런) 이면 안 끝난 주자가 0 일 때 닫고, 남았으면 아래 갈래로 (b0e04)', () => {
    expect(passPlayGate({ ...닫힘없음, homeRunFlag: true, liveRunnerCount: 0 }).open).toBe(false)
    expect(passPlayGate({ ...닫힘없음, poleHomeRunFlag: true, liveRunnerCount: 0 }).open).toBe(false)
    expect(passPlayGate({ ...닫힘없음, homeRunFlag: true, liveRunnerCount: 1 })).toEqual({ open: true, endCounter: 0 })
  })

  it('+0x125(홈런더비) 면 공이 멈출 때 닫고, 그 전에는 +0x120 = 0 으로 이어진다 (b0dde)', () => {
    expect(passPlayGate({ ...닫힘없음, homeRunDerby: true, ballStopped: true }).open).toBe(false)
    expect(passPlayGate({ ...닫힘없음, homeRunDerby: true, ballStopped: false, ballHeld: true, endCounter: 9 })).toEqual({
      open: true,
      endCounter: 0,
    })
  })

  describe('+0x110(파울) 갈래 b0d3a~b0db2 — 3아웃·세기를 안 보고 공만 본다', () => {
    const 공 = { stopped: false, currentTick: 10, landingTick: 20, fenceTick: -1, z: 20_000, angle: -100 }
    it('공이 멈추면 닫는다', () => {
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, stopped: true } }).open).toBe(false)
    })
    it('담장선을 먼저 넘고(aa4 < aa0) 떨어지는 그 틱에 닫는다', () => {
      const 넘은공 = { ...공, fenceTick: 15, landingTick: 20 }
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...넘은공, currentTick: 19 } }).open).toBe(true)
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...넘은공, currentTick: 20 } }).open).toBe(false)
      // 먼저 떨어진 공(aa0 ≤ aa4)은 이 갈래가 아니다
      expect(
        passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, fenceTick: 20, landingTick: 20, currentTick: 20 } }).open,
      ).toBe(true)
    })
    it('홈 뒤(z > 32599)로 −315 < 각 < −225 방향이면 닫는다', () => {
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, z: 32_600, angle: -270 } }).open).toBe(false)
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, z: 32_599, angle: -270 } }).open).toBe(true)
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, z: 32_600, angle: -225 } }).open).toBe(true)
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: { ...공, z: 32_600, angle: -315 } }).open).toBe(true)
    })
    it('3아웃이어도 · 세기도 안 건드린다', () => {
      expect(passPlayGate({ ...닫힘없음, foulFlag: true, foulBall: 공, outs: 3, endCounter: 7 })).toEqual({
        open: true,
        endCounter: 7,
      })
    })
  })
})

describe('0xaa05c · 0xa990c (주자관리)', () => {
  const 루에선주자 = (base: number, extra: Partial<RunnerState> = {}): RunnerState => ({
    ...createRunner(1, base, 300, {}),
    ...extra,
  })
  const atTarget = (runner: RunnerState) => isSamePoint(runner.position, basePosition(runner.targetBase))

  it('목표점에 선 주자라도 +0x94(요구 루)가 남아 있으면 진행 중이다', () => {
    expect(someRunnerStillActive([루에선주자(2)], atTarget)).toBe(false)
    expect(someRunnerStillActive([루에선주자(2, { requiredBase: 2 })], atTarget)).toBe(true)
    // +0x96(아웃·득점)이면 안 본다
    expect(someRunnerStillActive([루에선주자(2, { requiredBase: 2, isOut: true })], atTarget)).toBe(false)
    expect(someRunnerStillActive([루에선주자(2, { requiredBase: NONE, targetBase: 3 })], atTarget)).toBe(true)
  })

  it('안 끝난 주자 수 = 아웃·득점 아닌 주자', () => {
    expect(
      liveRunnerCountOf([루에선주자(1), 루에선주자(2, { isOut: true }), 루에선주자(3, { scored: true })]),
    ).toBe(1)
  })
})

describe('파울 판이 닫힌 뒤 0x35108 → 0xb6b58 — 스트라이크', () => {
  it('마지막 결과 코드([장면+0x10ac])가 7 이면 스트라이크 ≤ 1 일 때만 +1', () => {
    expect(strikesAfterPlay(0, 7)).toBe(1)
    expect(strikesAfterPlay(1, 7)).toBe(2)
    expect(strikesAfterPlay(2, 7)).toBe(2)
  })

  it('11(2스트라이크 번트 파울 아웃) · 13(파울 뜬공 아웃) · 6 은 안 건드린다', () => {
    expect(strikesAfterPlay(2, 11)).toBe(2)
    expect(strikesAfterPlay(1, 13)).toBe(1)
    expect(strikesAfterPlay(1, 6)).toBe(1)
  })

  it('웹 타석 카운트(atBatState 의 파울)와 같은 규칙이다', () => {
    for (const strikes of [0, 1, 2]) {
      const state = applyPitchResolution(createAtBat({ balls: 0, strikes }), { kind: '파울' })
      expect(state.strikes).toBe(strikesAfterPlay(strikes, 7))
    }
  })
})
