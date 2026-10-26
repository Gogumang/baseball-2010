import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { rollQuickRespinTeams, rollQuickStart } from '@/pages/general-mode/lib/quickStart'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 씨앗 0..499 에서 같은 팀끼리가 몇 번 나오나 */
function 같은팀수(): number {
  let count = 0
  for (let seed = 0; seed < 500; seed += 1) {
    const setup = rollQuickStart(createSeededRandom(seed))
    const respin = rollQuickRespinTeams(createSeededRandom(seed + 10_000))
    if (setup.userTeamId === setup.aiTeamId) count += 1
    if (respin.userTeamId === respin.aiTeamId) count += 1
  }
  return count
}

describe('B-63 빠른실행 같은 팀끼리', () => {
  it('원본: 재추첨이 없어 같은 팀끼리가 나온다', () => {
    expect(같은팀수()).toBeGreaterThan(0)
  })

  it('고침: 유저 팀을 뺀 후보에서 뽑아 같은 팀이 안 나온다 — 굴림 수는 같다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-63']))
    expect(같은팀수()).toBe(0)
    const 원본굴림 = createSeededRandom(7)
    setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG)
    rollQuickStart(원본굴림)
    const 고친굴림 = createSeededRandom(7)
    setBugfixConfigForTests(bugfixConfigWith(['B-63']))
    rollQuickStart(고친굴림)
    expect(고친굴림.rand(0, 1_000_000)).toBe(원본굴림.rand(0, 1_000_000))
  })
})
