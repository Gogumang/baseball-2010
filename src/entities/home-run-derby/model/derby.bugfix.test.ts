import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { applyDerbyPitch, createDerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyPitchOutcome, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { confirmDerbyNextBatter, createDerbyLineup, reserveDerbyNextBatter } from '@/entities/home-run-derby/model/derbyLineup'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 켜기 = (id: string) => setBugfixConfigForTests(bugfixConfigWith([id]))

const 땅볼 = (distance: number): DerbyPitchOutcome => ({ isHomeRun: false, distance, isEventZoneHit: false })

/** 9 공은 비거리 0, 마지막 열째 공이 비거리 900 — 누적이 첫 문턱 800 을 마지막 공에서 넘는다 */
const 열공 = (): DerbyRun => {
  let run = createDerbyRun()
  for (let index = 0; index < 9; index += 1) run = applyDerbyPitch(run, 땅볼(0))
  return applyDerbyPitch(run, 땅볼(900))
}

describe('B-53 홈런더비 마지막 공은 던진 공 수 · 단계 문턱에 안 든다', () => {
  it('원본: 던진 공 9 · 단계 0 으로 끝난다', () => {
    const run = 열공()
    expect(run.isFinished).toBe(true)
    expect(run.pitchesThrown).toBe(9)
    expect(run.stage).toBe(0)
  })

  it('고침: 던진 공 10 · 마지막 공의 누적으로 단계 1', () => {
    켜기('B-53')
    const run = 열공()
    expect(run.isFinished).toBe(true)
    expect(run.pitchesThrown).toBe(10)
    expect(run.stage).toBe(1)
    expect(run.totalDistance).toBe(900)
  })
})

describe('B-55 볼넷 · 사구 뒤 다른 타자가 친다', () => {
  it('원본: 볼넷이 다음 타순을 예약하고 0xd 에서 넘어간다', () => {
    const lineup = confirmDerbyNextBatter(reserveDerbyNextBatter(createDerbyLineup(3, 4)))
    expect(lineup.order).toBe(5)
  })

  it('고침: 내 타자가 그대로 친다', () => {
    켜기('B-55')
    const lineup = confirmDerbyNextBatter(reserveDerbyNextBatter(createDerbyLineup(3, 4)))
    expect(lineup.order).toBe(4)
    expect(lineup.reservedOrder).toBeNull()
  })
})
