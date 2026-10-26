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
 * 사람 수비 · CPU 공격 · 수동 송구 — 3루 주자 · 원본 코드 [100, 188, 125, 1](투수 앞 번트 땅볼). 3틱에 홈 송구 키('8')를 누르면
 * 홈으로 달려오는 3루 주자(1번)를 두고 공 쥔 포수(1)와 3루수(4)가 협살을 세운다(B-11 고친 길).
 */
const 홈송구판 = (keys: Record<number, string> = { 3: '8' }) =>
  runDefensePlay({
    outcome: 단타,
    trajectory: battedBallTrajectory([100, 188, 125, 1]),
    bases: { first: false, second: false, third: true },
    outs: 0,
    runAbility: 500,
    defenseIsCpu: false,
    offenseIsCpu: true,
    throwMode: '수동',
    controls: { side: '수비', keyAt: (tick) => (keys[tick] === undefined ? null : { key: keys[tick] }) },
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
  it('원본: 사람이 수비하면 협살이 시작하지 않는다 — 3루 주자는 16틱에 그냥 태그로 죽는다', () => {
    const 결과 = 홈송구판()
    expect(결과.rundowns).toBe(0)
    expect(결과.log.some((line) => line.includes('협살'))).toBe(false)
    expect(결과.log).toContain('16틱 1번 주자 태그 아웃 (0xb36d0 결과 3)')
  })

  it('고침: 사람 수비도 협살을 세워 마주 쫓아 태그한다 — 판 결과(진루 · 아웃)는 원본과 같다', () => {
    const 원본 = 홈송구판()
    setBugfixConfigForTests(bugfixConfigWith(['B-11']))
    const 고침 = 홈송구판()
    expect(고침.log).toContain('9틱 협살 시작 — 1번 주자 4↔3루 (야수 1·4)')
    expect(고침.log).toContain('13틱 협살 태그 — 1번 주자 아웃')
    expect(고침.rundowns).toBe(1)
    expect(고침.rundownOuts).toBe(1)
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
