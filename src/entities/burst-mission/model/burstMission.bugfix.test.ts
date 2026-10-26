import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { BURST_GOAL, judgeBurstGoal } from '@/entities/burst-mission/model/burstMissionJudge'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

/** 2아웃에서 단타 — 앞 주자가 잡혀 3아웃째가 났다 */
const 삼아웃단타 = () => burstResultBitsOf({ outcome: { kind: '안타', bases: 1 }, runsBattedIn: 0, outsBefore: 2, outsAdded: 1 })
/** 2아웃 끝내기 승리인데 타석은 땅볼 아웃(투수편 — 마지막 아웃을 잡아 이겼다) */
const 끝내기땅볼 = () =>
  burstResultBitsOf({ outcome: { kind: '아웃', detail: '땅볼아웃' }, runsBattedIn: 0, outsBefore: 2, outsAdded: 1, humanTeamWalkOff: true })

describe('B-52 돌발미션 판정', () => {
  it('원본: 3아웃째 단타는 "안타" 실패 · 끝내기면 실제 결과와 상관없이 공격 목표 성공', () => {
    expect(judgeBurstGoal(BURST_GOAL.안타, 삼아웃단타())).toBe('실패')
    expect(judgeBurstGoal(BURST_GOAL.홈런, 끝내기땅볼())).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.고의사구, 끝내기땅볼())).toBe('성공')
  })

  it('고침: 단타는 이닝이 끝나도 성공 · 끝내기 덧비트가 없어 실제 결과로 가린다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-52']))
    expect(judgeBurstGoal(BURST_GOAL.안타, 삼아웃단타())).toBe('성공')
    expect(judgeBurstGoal(BURST_GOAL.홈런, 끝내기땅볼())).toBe('실패')
    expect(judgeBurstGoal(BURST_GOAL.고의사구, 끝내기땅볼())).toBe('무효')
    expect(judgeBurstGoal(BURST_GOAL.아웃, 끝내기땅볼())).toBe('성공')
  })

  it('고침에도 고의사구 목표는 아무 볼넷이나 성공이다 — 고의사구 명령이 원본에 없다(고칠 것 아님)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-52']))
    const 볼넷 = burstResultBitsOf({ outcome: { kind: '볼넷' }, runsBattedIn: 0, outsBefore: 0, outsAdded: 0 })
    expect(judgeBurstGoal(BURST_GOAL.고의사구, 볼넷)).toBe('성공')
  })
})
