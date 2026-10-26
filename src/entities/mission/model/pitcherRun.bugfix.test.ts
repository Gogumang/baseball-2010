import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { applyPitcherOutcome, startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 노히트노런 = PITCHER_MISSIONS.find((mission) => mission.id === 13)!
const 퍼펙트 = PITCHER_MISSIONS.find((mission) => mission.id === 14)!
const 로제 = PITCHER_MISSIONS.find((mission) => mission.id === 4)!

describe('B-31 노히트노런이 볼넷 하나로 실패 · 무사사구가 사구를 안 셈 (0xaacc6 · 0xa8e2a)', () => {
  it('원본: 13번은 볼넷 · 사구로 무출루 실패, 4번(무사사구 1)은 사구로 안 깨진다', () => {
    expect(applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '볼넷' }).status).toBe('실패')
    expect(applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '사구' }).status).toBe('실패')
    expect(applyPitcherOutcome(startPitcherMission(로제), { kind: '사구' }).progress.brokenConditions).not.toContain('무사사구')
  })

  it('고침: 노히트노런은 사사구를 허용한다 — 안타 · 실점 한도는 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-31']))
    const 볼넷 = applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '볼넷' })
    expect(볼넷.allowed.baserunner).toBe(0)
    expect(볼넷.status).toBe('진행중')
    expect(applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '사구' }).status).toBe('진행중')
    expect(applyPitcherOutcome(startPitcherMission(노히트노런), { kind: '안타', bases: 1 }).status).toBe('실패')
  })

  it('고침: 무사사구 한도는 사구도 센다 — 퍼펙트는 사구로 무사사구 실패', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-31']))
    const 사구 = applyPitcherOutcome(startPitcherMission(퍼펙트), { kind: '사구' })
    expect(사구.allowed.walks).toBe(1)
    expect(사구.progress.brokenConditions).toEqual(['무사사구'])
    expect(사구.status).toBe('실패')
    expect(applyPitcherOutcome(startPitcherMission(로제), { kind: '사구' }).progress.brokenConditions).toContain('무사사구')
  })
})
