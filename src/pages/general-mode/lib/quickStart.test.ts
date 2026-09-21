import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { NO_ACE } from '@/pages/general-mode/lib/generalModeSetup'
import { quickStartTeamCandidates, rollQuickStart } from '@/pages/general-mode/lib/quickStart'

/** 빠른실행 (J-2 · J 1-2 확정) — 0x314b0 이 준비 기록을 통째로 굴린다 */

/** `bfa55(0, n)` 을 흉내 낸다 — 미리 정한 [0,1) 값을 차례로 돌려준다 */
function 정해진난수(values: readonly number[]): RandomPort {
  let cursor = 0
  const take = () => values[cursor++] ?? 0
  return {
    next: take,
    nextInRange: (minimum, maximum) => minimum + take() * (maximum - minimum),
    pick: (candidates) => candidates[0],
  }
}

describe('빠른실행 후보 목록', () => {
  it('기본 열 팀에 열린 히든 팀만 번호순으로 덧붙인다', () => {
    expect(quickStartTeamCandidates()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(quickStartTeamCandidates([14, 11])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14])
  })
})

describe('빠른실행 굴림', () => {
  it('원본 차례대로 유저 팀·AI 팀·선공·마투수·마타자를 뽑는다', () => {
    // 0.35×10 = 3 · 0.75×10 = 7 · 0.6×2 = 1(후공) · 0.5×2 = 1(열린 것 중 둘째) · 마타자는 안 뽑는다
    const setup = rollQuickStart(정해진난수([0.35, 0.75, 0.6, 0.5]), {
      openedAcePitcherIds: [2, 4],
    })

    expect(setup.userTeamId).toBe(3)
    expect(setup.aiTeamId).toBe(7)
    expect(setup.playerSide).toBe(PLAYER_SIDE_LAST_BAT)
    expect(setup.acePitcherId).toBe(4)
    expect(setup.aceBatterId).toBe(NO_ACE)
  })

  it('선공 뽑기는 50% 다 — 0 이면 유저 선공', () => {
    const setup = rollQuickStart(정해진난수([0, 0, 0]))

    expect(setup.playerSide).toBe(PLAYER_SIDE_FIRST_BAT)
  })

  it('⚠️ 원본 버그 — 재추첨이 없어 같은 팀끼리 경기가 나올 수 있다', () => {
    const setup = rollQuickStart(정해진난수([0.35, 0.35, 0, 0, 0]))

    expect(setup.userTeamId).toBe(3)
    expect(setup.aiTeamId).toBe(3)
  })

  it('구장은 유저 팀 번호를 그대로 쓴다 — 히든 팀이면 구장 목록 밖(10~14)이 된다', () => {
    const setup = rollQuickStart(정해진난수([10 / 11, 0, 0]), { openedHiddenTeamIds: [14] })

    expect(setup.userTeamId).toBe(14)
    expect(setup.stadiumId).toBe(14)
  })

  it('열린 마선수가 하나도 없으면 −1(없음) 이다', () => {
    const setup = rollQuickStart(정해진난수([0, 0, 0]))

    expect(setup.acePitcherId).toBe(NO_ACE)
    expect(setup.aceBatterId).toBe(NO_ACE)
  })
})
