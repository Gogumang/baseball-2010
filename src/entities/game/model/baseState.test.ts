import { describe, expect, it } from 'vitest'
import { advanceRunners, EMPTY_BASES, runnerCountOf } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'

const 만루: BaseState = { first: true, second: true, third: true }
const 주자1루: BaseState = { first: true, second: false, third: false }
const 주자3루: BaseState = { first: false, second: false, third: true }

describe('advanceRunners — 홈런', () => {
  it('만루 홈런은 4점이고 베이스를 비운다', () => {
    const result = advanceRunners(만루, { kind: '홈런' }, 0)

    expect(result.runsScored).toBe(4)
    expect(result.bases).toEqual(EMPTY_BASES)
    expect(result.outsAdded).toBe(0)
  })

  it('주자 없는 홈런은 1점이다', () => {
    expect(advanceRunners(EMPTY_BASES, { kind: '홈런' }, 0).runsScored).toBe(1)
  })
})

describe('advanceRunners — 안타', () => {
  it('단타는 주자를 한 베이스씩 보내고 3루 주자만 득점한다', () => {
    const result = advanceRunners(만루, { kind: '안타', bases: 1 }, 0)

    expect(result.runsScored).toBe(1)
    expect(result.bases).toEqual(만루)
  })

  it('2루타는 2·3루 주자가 득점하고 1루 주자는 3루로 간다', () => {
    const result = advanceRunners(만루, { kind: '안타', bases: 2 }, 0)

    expect(result.runsScored).toBe(2)
    expect(result.bases).toEqual({ first: false, second: true, third: true })
  })

  it('3루타는 모든 주자가 득점하고 타자만 3루에 남는다', () => {
    const result = advanceRunners(만루, { kind: '안타', bases: 3 }, 0)

    expect(result.runsScored).toBe(3)
    expect(result.bases).toEqual({ first: false, second: false, third: true })
  })

  it('주자 없을 때 단타는 1루에만 주자가 생긴다', () => {
    const result = advanceRunners(EMPTY_BASES, { kind: '안타', bases: 1 }, 0)

    expect(result.runsScored).toBe(0)
    expect(result.bases).toEqual(주자1루)
  })
})

describe('advanceRunners — 볼넷', () => {
  it('주자 없으면 1루만 채운다', () => {
    expect(advanceRunners(EMPTY_BASES, { kind: '볼넷' }, 0).bases).toEqual(주자1루)
  })

  it('1루만 있으면 2루까지 밀린다', () => {
    const result = advanceRunners(주자1루, { kind: '볼넷' }, 0)

    expect(result.bases).toEqual({ first: true, second: true, third: false })
    expect(result.runsScored).toBe(0)
  })

  it('3루 주자는 밀리지 않으므로 득점하지 않는다', () => {
    const result = advanceRunners(주자3루, { kind: '볼넷' }, 0)

    expect(result.runsScored).toBe(0)
    expect(result.bases).toEqual({ first: true, second: false, third: true })
  })

  it('만루 볼넷은 밀어내기 1점이다', () => {
    const result = advanceRunners(만루, { kind: '볼넷' }, 0)

    expect(result.runsScored).toBe(1)
    expect(result.bases).toEqual(만루)
  })
})

describe('advanceRunners — 아웃', () => {
  it('2아웃 미만에서 3루 주자가 있으면 뜬공은 희생플라이가 된다', () => {
    const result = advanceRunners(주자3루, { kind: '아웃', detail: '뜬공아웃' }, 1)

    expect(result.runsScored).toBe(1)
    expect(result.outsAdded).toBe(1)
    expect(result.bases.third).toBe(false)
  })

  it('2아웃에서는 희생플라이가 성립하지 않는다', () => {
    const result = advanceRunners(주자3루, { kind: '아웃', detail: '뜬공아웃' }, 2)

    expect(result.runsScored).toBe(0)
    expect(result.bases).toEqual(주자3루)
  })

  it('땅볼아웃은 3루 주자가 있어도 득점하지 않는다', () => {
    const result = advanceRunners(주자3루, { kind: '아웃', detail: '땅볼아웃' }, 0)

    expect(result.runsScored).toBe(0)
    expect(result.outsAdded).toBe(1)
  })

  it('삼진은 주자를 그대로 두고 아웃만 올린다', () => {
    const result = advanceRunners(만루, { kind: '삼진' }, 0)

    expect(result).toEqual({ bases: 만루, runsScored: 0, outsAdded: 1 })
  })
})

describe('runnerCountOf', () => {
  it('베이스에 있는 주자 수를 센다', () => {
    expect(runnerCountOf(EMPTY_BASES)).toBe(0)
    expect(runnerCountOf(주자1루)).toBe(1)
    expect(runnerCountOf(만루)).toBe(3)
  })
})
