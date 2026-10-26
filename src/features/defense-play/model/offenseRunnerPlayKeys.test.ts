import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { startRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import { runStealPlay, stealPlayEngineInputOf } from '@/features/defense-play/model/stealPlay'
import { runPickoffPlay, startPickoffPlay } from '@/features/defense-play/model/pickoffPlay'

/** 사람 공격 — 틱별 눌린 키 */
const keys = (map: Record<number, string>) => ({
  side: '공격' as const,
  keyAt: (tick: number) => (map[tick] === undefined ? null : { key: map[tick]! }),
})
const 일루 = { ...EMPTY_BASES, first: true }
const 일삼루 = { ...EMPTY_BASES, first: true, third: true }
/** 우리 공격 · CPU 수비 (팀 경기 사람 공격 쪽 배선과 같다) */
const 우리공격 = { outs: 0, runAbility: 500, defenseIsCpu: true, offenseIsCpu: false } as const
/**
 * 발 빠른 주자(주루 999 → 속도 369) — 한 틱 이동 0xbf158 이 맨해튼 거리로 나눠 대각선 1루→2루를 평면 속도의 0.71 배로 가므로
 * 주루 500 주자는 도루가 늘 잡힌다. 도루가 사는 판을 보려면 빠른 주자가 필요하다
 */
const 빠른공격 = { ...우리공격, runAbility: 999 } as const

describe('사람 공격의 주자 판 키 — 0x53420 → 0x5331c(0x582 · 0x584) · 0x585', () => {
  it('도루 판(종류 5) 귀루 — 2루로 뛰던 1루 주자가 1루로 돌아서고, 플레이+0x128 로 CPU 송구 결정이 다시 돈다', () => {
    const 그냥 = runStealPlay({ ...빠른공격, bases: 일루, stealingFrom: [1] })
    expect(그냥.advance.bases).toEqual({ ...EMPTY_BASES, second: true })

    // '3' = 귀루 1(+0x8c == 1 인 주자). 리드로 2루 쪽에 나가 있던 주자를 1루로 되돌린다 → 포수가 1루로 던져 태그
    const 귀루 = runStealPlay({ ...빠른공격, bases: 일루, stealingFrom: [1], controls: keys({ 0: '3' }) })
    expect(귀루.log[0]).toBe('0틱 귀루 키 — 주자 1')
    expect(귀루.log).toContain('0틱 1번 야수가 1루로 송구 — 8틱 도착 (CPU 결정)')
    expect(귀루.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 1 })
  })

  it('도루 판 진루 — 수동 주루에서도 3루 주자를 홈으로 보낸다 (\'8\' = 진루 3, 목표 = +0x8c + 1 = 홈 4)', () => {
    const 그냥 = runStealPlay({ ...빠른공격, bases: 일삼루, stealingFrom: [1], runningMode: '수동' })
    expect(그냥.advance.bases).toEqual({ first: false, second: true, third: true })

    const 진루 = runStealPlay({ ...빠른공격, bases: 일삼루, stealingFrom: [1], runningMode: '수동', controls: keys({ 0: '8' }) })
    expect(진루.log[0]).toBe('0틱 진루 키 — 주자 2')
    // 홈 커버 포수가 공을 쥐고 있어 직접 밟고 태그한다
    expect(진루.log).toContain('22틱 2번 주자 아웃 (0xb36d0 결과 3)')
    expect(진루.runnerFates).toEqual([
      { fromBase: 1, scored: false, retired: false },
      { fromBase: 3, scored: false, retired: true },
    ])
  })

  it('견제 판(종류 4)도 받는다 — 견제 송구가 1루로 가는 사이 1루 주자를 2루로 보내면 1루가 아니라 2루 송구로 판이 간다', () => {
    const 그냥 = runPickoffPlay({ ...우리공격, targetBase: 1, bases: 일루 })
    expect(그냥.advance.outsAdded).toBe(1)
    expect(그냥.log).toContain('8틱 1번 주자 견제사 (0xb36d0 결과 3)')

    const 진루 = runPickoffPlay({ ...우리공격, targetBase: 1, bases: 일루, controls: keys({ 0: '2' }) })
    expect(진루.log[0]).toBe('0틱 진루 키 — 주자 1')
    // 1루수가 쥔 뒤 2루로 던진다. 대각선 1루→2루를 맨해튼 걸음(0xbf158)으로 가는 주자는 2루 앞에서 잡힌다
    expect(진루.log).toContain('9틱 2번 야수가 2루로 송구 — 17틱 도착 (CPU 결정)')
    expect(진루.advance).toEqual({ bases: EMPTY_BASES, runsScored: 0, outsAdded: 1 })
  })

  it('수비 쪽 키 뜻(송구)과 섞이지 않는다 — 같은 \'2\' 도 사람이 수비면 2루 송구다', () => {
    const 수비 = runPickoffPlay({
      targetBase: 1,
      bases: 일루,
      outs: 0,
      offenseIsCpu: true,
      controls: { side: '수비', keyAt: (tick) => (tick === 0 ? { key: '2' } : null) },
    })
    expect(수비.log.some((line) => line.includes('진루 키'))).toBe(false)
    expect(수비.log).toContain('0틱 사람이 2루로 송구 지시')
  })

  it('OK 슬라이딩 0x585 — 71~94% 온 주자에게 걸리고 효과음 10 은 한 판 한 번(+0x31c)', () => {
    const stepper = startRunnerPlay({ ...stealPlayEngineInputOf({ ...우리공격, bases: 일루, stealingFrom: [1] }), controls: keys({}) })
    // 리드 18 걸음(맨해튼 나눗수라 대각선은 짧다) 뒤 다섯 틱을 더 달려야 71% 를 넘는다
    for (let tick = 0; tick < 5; tick += 1) stepper.step(null)
    stepper.step({ key: '5' })
    expect(stepper.slidingSoundThisTick).toBe(true)
    stepper.step({ key: '5' })
    // 이미 슬라이딩 중이어도 0xa96ec 는 또 걸지만 소리는 잠금으로 한 번뿐
    expect(stepper.slidingSoundThisTick).toBe(false)
    stepper.step(null)
    expect(stepper.slidingSoundThisTick).toBe(false)
  })

  it('견제 판의 키 진행기도 슬라이딩 소리 칸을 낸다', () => {
    const stepper = startPickoffPlay({ ...우리공격, targetBase: 1, bases: 일루, controls: keys({}) })
    expect(stepper.slidingSoundThisTick).toBe(false)
  })
})
