import { describe, expect, it } from 'vitest'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import {
  canSelectTeam, canUseHiddenTeams, hiddenTeamHintMessage, isHiddenTeam, isTeamOpened,
} from '@/pages/general-mode/lib/hiddenTeam'

/** 히든 팀 잠금 (J-1 확정) — 열려 있어도 **일반모드에서만** 고를 수 있다 */

describe('히든 팀 판정', () => {
  it('10~14 가 히든이다', () => {
    expect(isHiddenTeam(9)).toBe(false)
    expect(isHiddenTeam(10)).toBe(true)
    expect(isHiddenTeam(14)).toBe(true)
    expect(isHiddenTeam(15)).toBe(false)
  })

  it('0~9 는 기록과 상관없이 늘 열려 있다', () => {
    expect(isTeamOpened(0, [])).toBe(true)
    expect(isTeamOpened(12, [])).toBe(false)
    expect(isTeamOpened(12, [12])).toBe(true)
  })
})

describe('고를 수 있는가', () => {
  it('히든 팀은 일반모드(1) 에서만 열 수 있다', () => {
    expect(canUseHiddenTeams(TEAM_GAME_MODE.일반)).toBe(true)
    expect(canUseHiddenTeams(TEAM_GAME_MODE.시즌)).toBe(false)
    expect(canUseHiddenTeams(TEAM_GAME_MODE.대전)).toBe(false)
  })

  it('일반모드라도 기록이 없으면 못 고른다', () => {
    expect(canSelectTeam(11, { openedHiddenIds: [], mode: TEAM_GAME_MODE.일반 })).toBe(false)
    expect(canSelectTeam(11, { openedHiddenIds: [11], mode: TEAM_GAME_MODE.일반 })).toBe(true)
  })

  it('다른 모드에서는 열려 있어도 늘 막힌다', () => {
    expect(canSelectTeam(11, { openedHiddenIds: [11], mode: TEAM_GAME_MODE.시즌 })).toBe(false)
    // 히든이 아닌 팀은 어느 모드에서나 고를 수 있다
    expect(canSelectTeam(3, { openedHiddenIds: [], mode: TEAM_GAME_MODE.시즌 })).toBe(true)
  })
})

describe('힌트 팝업 글', () => {
  it('일반모드에서 잠긴 팀은 머리글 + 팀별 힌트 + "선택 할 수 없는 팀입니다" 다', () => {
    const message = hiddenTeamHintMessage(13, { openedHiddenIds: [], mode: TEAM_GAME_MODE.일반 })

    // StrMODE[225] + [216+13 = 229 "메이저를 넘어서라!"] + [0]
    expect(message).toBe(
      ORIGINAL_MODE_TEXT[225] + ORIGINAL_MODE_TEXT[229] + ORIGINAL_MODE_TEXT[0],
    )
  })

  it('다른 모드에서 열린 팀은 "일반모드에서 사용 할 수 있습니다" 만 붙는다', () => {
    const message = hiddenTeamHintMessage(10, { openedHiddenIds: [10], mode: TEAM_GAME_MODE.시즌 })

    expect(message).toBe(ORIGINAL_MODE_TEXT[225] + ORIGINAL_MODE_TEXT[226] + ORIGINAL_MODE_TEXT[1])
  })

  it('다른 모드에서 잠긴 팀은 두 줄이 모두 붙는다', () => {
    const message = hiddenTeamHintMessage(14, { openedHiddenIds: [], mode: TEAM_GAME_MODE.시즌 })

    expect(message).toBe(
      ORIGINAL_MODE_TEXT[225] + ORIGINAL_MODE_TEXT[230] + ORIGINAL_MODE_TEXT[0] + ORIGINAL_MODE_TEXT[1],
    )
  })

  it('고를 수 있으면 팝업이 없다', () => {
    expect(hiddenTeamHintMessage(10, { openedHiddenIds: [10], mode: TEAM_GAME_MODE.일반 })).toBeNull()
    expect(hiddenTeamHintMessage(2, { openedHiddenIds: [], mode: TEAM_GAME_MODE.시즌 })).toBeNull()
  })
})
