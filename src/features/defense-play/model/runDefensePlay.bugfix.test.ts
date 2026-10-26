import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BaseState } from '@/entities/game/model/baseState'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 단타: AtBatOutcome = { kind: '안타', bases: 1 }
const 주자1루: BaseState = { first: true, second: false, third: false }

/**
 * 사람 수비 · CPU 공격 · 수동 송구 — 2루 주자 · 원본 코드 [125, 1000, 100, 0](3루 쪽 땅볼). 3틱에 3루 송구 키('4')를 누르면
 * 3루로 달려오는 2루 주자(1번)를 두고 공 쥔 3루 커버(4)와 2루 커버(3)가 협살을 세운다(B-11 고친 길).
 * (r268 맨해튼 거리 0xbfa2c 뒤의 틱이다 — 예전 장면 [100, 188, 125, 1] 3루 주자 홈 송구는 협살 조건이 안 선다)
 */
const 삼루송구판 = () =>
  runDefensePlay({
    outcome: 단타,
    trajectory: battedBallTrajectory([125, 1000, 100, 0]),
    bases: { first: false, second: true, third: false },
    outs: 0,
    runAbility: 500,
    defenseIsCpu: false,
    offenseIsCpu: true,
    throwMode: '수동',
    controls: { side: '수비', keyAt: (tick) => (tick === 3 ? { key: '4' } : null) },
  })

/** `runDefensePlay.test.ts` 협살 절과 같은 판 — 원본 코드 5, 16틱 귀루 키로 1루로 돌아오는 1번 주자 */
const 협살상황 = (defenseIsCpu: boolean, keys: Record<number, string> = { 16: '3' }) =>
  runDefensePlay({
    outcome: 단타,
    trajectory: battedBallTrajectory([68, 808, 282, 1]),
    bases: 주자1루,
    outs: 0,
    runAbility: 500,
    defenseIsCpu,
    controls: { side: '공격', keyAt: (tick) => (keys[tick] === undefined ? null : { key: keys[tick] }) },
  })

describe('B-11 사람 수비에서 협살이 안 걸림', () => {
  it('원본: 사람이 수비하면 협살이 시작하지 않는다 — 2루 주자는 16틱에 그냥 태그로 죽고 타자주자는 28틱 1루 아웃', () => {
    const 결과 = 삼루송구판()
    expect(결과.rundowns).toBe(0)
    expect(결과.log.some((line) => line.includes('협살'))).toBe(false)
    expect(결과.log).toContain('16틱 1번 주자 태그 아웃 (0xb36d0 결과 3)')
    expect(결과.log).toContain('28틱 0번 주자 루 아웃 (0xb36d0 결과 2)')
  })

  it('고침: 사람 수비도 협살을 세워 마주 쫓아 태그한다 — 태그는 결과 코드 13 이라 0xafa60 이 이어 던져 판 결과는 원본과 같다', () => {
    const 원본 = 삼루송구판()
    setBugfixConfigForTests(bugfixConfigWith(['B-11']))
    const 고침 = 삼루송구판()
    expect(고침.log).toContain('12틱 협살 시작 — 1번 주자 3↔2루 (야수 4·3)')
    expect(고침.log).toContain('14틱 협살 태그 — 1번 주자 아웃')
    expect(고침.rundowns).toBe(1)
    expect(고침.rundownOuts).toBe(1)
    expect(고침.advance.outsAdded).toBe(2)
    expect(고침.advance).toEqual(원본.advance)
  })

  it('고침: 사람 수비는 포스로 밀려 가는 주자(0xb1b54)를 협살하지 않는다 — 타자주자를 1루에서 포스로 잡는다', () => {
    // [55, 700, 200, 0] 1루수 땅볼 · 3틱 1루 송구 키('6'): 1루수가 1루를 직접 밟으러 가는 사이 타자주자(포스)를 협살로 쫓으면
    // 루를 비워 세이프가 된다. 고친 길은 그 주자를 빼서 원본처럼 아웃이다
    const 일루판 = () =>
      runDefensePlay({
        outcome: 단타,
        trajectory: battedBallTrajectory([55, 700, 200, 0]),
        bases: 주자1루,
        outs: 0,
        runAbility: 500,
        defenseIsCpu: false,
        offenseIsCpu: true,
        throwMode: '수동',
        controls: { side: '수비', keyAt: (tick) => (tick === 3 ? { key: '6' } : null) },
      })
    const 원본 = 일루판()
    setBugfixConfigForTests(bugfixConfigWith(['B-11']))
    const 고침 = 일루판()
    expect(고침.rundowns).toBe(0)
    expect(고침.advance).toEqual(원본.advance)
    expect(고침.advance.outsAdded).toBe(1)
  })

  it('고침: CPU 수비는 원본과 똑같다', () => {
    const 원본 = 협살상황(true, { 16: '3', 17: '2', 18: '3' })
    setBugfixConfigForTests(bugfixConfigWith(['B-11']))
    const 고침 = 협살상황(true, { 16: '3', 17: '2', 18: '3' })
    expect(고침.log).toEqual(원본.log)
    expect(고침.advance).toEqual(원본.advance)
  })
})
