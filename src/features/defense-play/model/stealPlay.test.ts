import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { RUNNER_PLAY_RESULT, runRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import { isStealPlayResult, runStealPlay, stealCallSoundIdOf, stealPlayEngineInputOf } from '@/features/defense-play/model/stealPlay'
import { assignCoversForTick } from '@/entities/fielding/model/coverAssignment'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE } from '@/entities/fielding/model/fieldingState'
import { runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'

function 세는난수(ratio: number): RandomPort & { readonly count: () => number } {
  let rolls = 0
  return {
    ...createFractionRandom(() => {
      rolls += 1
      return ratio
    }),
    count: () => rolls,
  }
}

const 일루 = { ...EMPTY_BASES, first: true }
const 일삼루 = { ...EMPTY_BASES, first: true, third: true }

describe('도루 한 판 — 종류 5 (0xb2950 · 0xb1c90 · 0xb36d0 · 0xb4292)', () => {
  it('판이 열릴 때 도루 주자는 이미 15+3 틱 달려 나가 있다(0x46418 → 0x3d7b8) — 사람이 2루로 던져도 세이프 9 · 콜 17', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, manualThrowBase: 2 })
    // 속도 335 로 1루(25946, 24175)에서 2루 쪽으로 18 틱 — 그림 0틱은 움직이기 전이다
    expect(result.ticks[0].runners[0]).toMatchObject({ x: 21338, z: 20298, base: 2 })
    expect(result.throwBase).toBe(2)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.SAFE)
    expect(stealCallSoundIdOf(result)).toBe(17)
    expect(result.advance).toEqual({ bases: { ...EMPTY_BASES, second: true }, runsScored: 0, outsAdded: 0 })
    expect(result.runnerFates).toEqual([{ fromBase: 1, scored: false, retired: false }])
    expect(result.caughtFrom).toEqual([])
    expect(result.stolenFrom).toEqual([1])
  })

  it('도루 안 한 주자도 0xcffb0 틱(3루 7)만큼 다음 루로 갔다가 목표를 제 루로 되돌린 채 판이 열린다', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0, runAbility: 500 })
    const third = result.ticks[0].runners[1]
    expect(third.base).toBe(3)
    expect(third.isAdvancing).toBe(false)
    expect({ x: third.x, z: third.z }).not.toEqual({ x: 14_055, z: 24_175 })
  })

  it('타자주자를 만들지 않는다 — 주자는 찬 루 오름차순이고 번호는 1 부터', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0 })
    expect(result.ticks[0].runners.map((runner) => runner.index)).toEqual([1, 2])
  })

  it('사람이 3루를 고르면 3루 주자는 제 루 위라 세이프(결과 9 · 콜 17) — 1루 주자는 그사이 2루에 닿는다', () => {
    const result = runStealPlay({ bases: 일삼루, stealingFrom: [1], outs: 0, manualThrowBase: 3 })
    expect(result.throwBase).toBe(3)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.SAFE)
    expect(stealCallSoundIdOf(result)).toBe(17)
    expect(result.advance).toEqual({ bases: { first: false, second: true, third: true }, runsScored: 0, outsAdded: 0 })
    expect(result.stolenFrom).toEqual([1])
    expect(result.caughtFrom).toEqual([])
  })

  it('홈 도루 — 공 쥔 포수가 홈 커버라 던지지 않고(0xb2c90 직접 밟기) 홈에서 태그한다', () => {
    const result = runStealPlay({ bases: { ...EMPTY_BASES, third: true }, stealingFrom: [3], outs: 1 })
    expect(result.throwBase).toBe(-1)
    expect(result.resultCode).toBe(RUNNER_PLAY_RESULT.OUT)
    expect(result.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 1 })
  })

  it('난수는 판이 열릴 때 도루 주자 리드 rand(0,9) 한 번, 송구 때 악송구 굴림(0xa1828) 한 번 — 악송구면 넷 더(수평·수직 속도 · 방향 크기 · 부호)', () => {
    const quiet = 세는난수(0.5)
    const plain = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 0, random: quiet, manualThrowBase: 2 })
    // 리드 · 악송구 · 긴 송구 흔들림(a198c — 홈 → 2루 10275 > 8200) · 받는 2루수의 펌블 굴림(b4224)
    expect(quiet.count()).toBe(4)
    expect(plain.throwBase).toBe(2)
    expect(plain.errantThrow).toBe(false)

    // 늘 0 인 난수 — 악송구(+4)가 나고, 예보 vt24(0)가 고른 야수가 줍는 족족 움직이는 공을 펌블해 0xb3148 로 튕긴다
    // (튕김 rand(−20, 20) · 다시 줍는 펌블 굴림) — 그사이 도루 주자가 홈까지 간다
    const wild = 세는난수(0)
    const errant = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 0, random: wild, manualThrowBase: 2 })
    // 판은 안전망(240틱)까지 간다 — 튕김마다 두 굴림(펌블 · rand(−20, 20)). r162: 판 시작 · 매 틱 0xb1c90 의 0xb203a 가 2루 커버가
    // 아닌 유격수를 기본 자리 0xd8764(14500, 17600)로 물려 11틱 튕김을 유격수(예전 21틱) 대신 2루수가 12~15틱에 거푸 줍는다 → 36 → 44
    expect(wild.count()).toBe(44)
    expect(errant.errantThrow).toBe(true)
    expect(errant.fumbled).toBe(true)
    expect(errant.resultCode).toBeNull()
    expect(stealCallSoundIdOf(errant)).toBeNull()
    expect(errant.advance).toEqual({ bases: EMPTY_BASES, runsScored: 1, outsAdded: 0 })
  })

  it('사람 수비·수동 송구에서 키가 없으면 포수는 공을 들고 있다 — 0xb1c90 자동 가지에는 송구 호출이 없다', () => {
    const counted = 세는난수(0.95)
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500, random: counted })
    expect(result.throwBase).toBe(-1)
    expect(result.resultCode).toBeNull()
    expect(result.stolenFrom).toEqual([1])
    // 굴림은 리드 rand(0,9) 한 번뿐 — 악송구 굴림이 없다
    expect(counted.count()).toBe(1)
  })

  it('홈 커버는 포수 — b297a 가 야수 1~4 를 루 위에 놓고(0xbee60) 목표 = 루, 고르기 b3e54 가 포수를 AI 1 로 둬도 b23a4 가 홈을 되돌린다', () => {
    const start = stealPlayEngineInputOf({ bases: 일루, stealingFrom: [1], outs: 0 })
    const 포수 = start.fielders[1]
    expect(포수?.position).toEqual(basePosition(0))
    expect(포수?.target).toEqual(basePosition(0))
    expect(포수?.aiState).toBe(AI_STATE.CHASE)
    expect([2, 3, 4].map((slot) => start.fielders[slot]?.position)).toEqual([1, 2, 3].map((base) => basePosition(base)))
    // 0xb1c90 를 판 시작 상태로 — b1d48 이 홈을 투수에게 넘기려 해도 b23a4(포수 목표 = 홈 · AI ≠ 9)가 포수로 되돌린다
    const covers = assignCoversForTick({
      context: { play: start.play, fielders: start.fielders, runners: start.runners, currentTick: 0, landingTick: -1 },
      ballToFirstSide: false,
      // 0xa276c 종류 5 — 공 첫 점 0xd7c30
      ballStartPoint: { x: 20_000, y: 0, z: 29_705 },
    })
    expect(covers.covers).toEqual([1, 2, 3, 4])
    // b2564 — AI 1 인 포수는 커버 상태로 안 바뀐다
    expect(covers.coverStates.map((state) => state.slot)).toEqual([2, 3, 4])
  })

  it('판 시작 b29d0 · 매 틱 vt4c 끝 0xb1c90 — 2루 커버가 아닌 유격수는 0xb203a 로 기본 자리 0xd8764(14500, 17600)에 간다 (r162)', () => {
    const start = stealPlayEngineInputOf({ bases: 일루, stealingFrom: [1], outs: 0 })
    expect(start.play.coverOfBase).toEqual([1, 2, 3, 4])
    expect(start.fielders[5]?.target).toEqual({ x: 14_500, y: 0, z: 17_600 })
    expect(start.fielders[5]?.aiState).toBe(AI_STATE.BUSY)
    // 키 없는 사람 수비 — 포수가 공을 든 채 판이 닫힐 때까지 유격수가 그 자리로 걷는다
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 500 })
    const 유격 = result.ticks.map((view) => view.fielders.find((fielder) => fielder.slot === 5))
    // 첫 그림은 이동 앞(시작 자리) — 다음 그림부터 걷는다
    expect(유격[0]?.x).toBe(17_273)
    expect(유격[1]?.x).toBeLessThan(17_273)
    expect(유격[유격.length - 1]?.x).toBe(14_500)
    expect(유격[유격.length - 1]?.z).toBe(17_600)
  })

  it('포수가 던지면 vt34 가 AI 1 을 내리고 vt30 의 b2564 가 커버 표의 포수를 홈 커버(AI 2)로 보낸다', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0, runAbility: 0, manualThrowBase: 2 })
    expect(result.throwBase).toBe(2)
    expect(result.log[0]).toContain('1번 야수가 2루로 송구')
    // 판 내내 홈 위 — 시작 자리 0xd86ec[1] = (20000, 0, 29705) 로 돌아가지 않는다
    expect(result.ticks.length).toBeGreaterThan(10)
    expect(result.ticks.every((tick) => tick.fielders[1]?.z === basePosition(0).z && tick.fielders[1]?.x === basePosition(0).x)).toBe(true)
  })

  it('재생 칸에 든 결과가 도루 판인지 가를 수 있다 — 견제 결과는 아니다', () => {
    const result = runStealPlay({ bases: 일루, stealingFrom: [1], outs: 0 })
    expect(isStealPlayResult(result)).toBe(true)
    expect(isStealPlayResult(null)).toBe(false)
    const pickoff = runPickoffPlay({ targetBase: 1, bases: 일루, outs: 0 })
    expect(isStealPlayResult(pickoff)).toBe(false)
  })
})

describe('도루 판 그림 칸 — 공 가진 야수 고리(0x43cb0) · 이름 판 · 마선수 주자 (그림만)', () => {
  it('판 시작 포수 쥐기는 0x17 진입이 지워 고리가 없고, 2루수가 송구를 쥔 틱부터 그 칸에 뜬다', () => {
    const result = runStealPlay({
      bases: 일루,
      stealingFrom: [1],
      outs: 0,
      runAbility: 500,
      manualThrowBase: 2,
      offenseIsCpu: true,
      fielderPlates: [null, { name: '포수', positionCode: 2 }, null, { name: '이루수', positionCode: 4 }],
      runnerAces: { first: 3 },
    })
    expect(result.ticks[0].holderMark).toBeNull()
    const 쥔틱 = result.ticks.find((view) => view.holderMark != null)
    expect(쥔틱?.holderMark).toEqual({ slot: 3, anim: 1 })
    expect(쥔틱?.holderPlate).toEqual({ name: '이루수', positionCode: 4 })
    expect(result.ticks[0].runners[0]?.isAce).toBe(true)
    expect(result.ticks[0].runnerAceSprite).toBe(3)
  })
})

describe('중계 이어 던지기 b4616 — 주자 판에도 있다 (r214)', () => {
  // 3루 주자 하나 · 공은 중견수(8)가 쥐었다 — 홈까지 21705 라 0xb3444 가 내야 중계를 끼운다
  const 판 = (cpu: boolean) => {
    const base = stealPlayEngineInputOf({ bases: { ...EMPTY_BASES, third: true }, stealingFrom: [], outs: 0 })
    return runRunnerPlay({
      ...base,
      fielders: base.fielders.map((fielder) =>
        fielder.slot === 8
          ? { ...fielder, holdingBall: true, actionRemainingTicks: 0 }
          : fielder.slot === 1
            ? { ...fielder, holdingBall: false }
            : fielder,
      ),
      play: { ...base.play, ballHolderSlot: 8, catchFielderSlot: 8, held: true, wantsThrow: cpu },
      defenseIsCpu: cpu,
      throwMode: '수동',
      ...(cpu ? {} : { manualThrowBase: 0 }),
    })
  }

  it('사람 목표(b4660 → 0xb2c90)로 던진 먼 송구는 중계맨이 쥔 뒤 준비 틱(내야 3)이 지난 틱에 최종 받는 야수에게 이어 던진다', () => {
    const 결과 = 판(false)
    expect(결과.log).toContain('0틱 8번 야수가 0루로 송구 — 12틱 도착 (5번 야수 중계)')
    expect(결과.log).toContain('12틱 5번 야수가 공을 쥐었다')
    expect(결과.log.some((line) => line.startsWith('15틱 5번 야수가 0루로 송구') && line.endsWith('(중계 이어 던지기)'))).toBe(true)
  })

  it('CPU 송구 결정 0xafa60 이 던진 공은 계획이 지워져(afb08 0xb0ea0) 이어 던지지 않는다', () => {
    const 결과 = 판(true)
    expect(결과.log.some((line) => line.includes('중계 이어 던지기'))).toBe(false)
  })
})
