import { describe, expect, it } from 'vitest'
import { MODE_RESET_TEXT, careerResetTargetOf, judgeModeReset } from '@/entities/settings/model/modeReset'

describe('모드 초기화 판정 (0x2c6d8 하위 1 — StrMAINMENU 210·211·212·213)', () => {
  it('나만의리그 타자편 — 시즌 팀에 있고 시즌 경기가 진행 중이면 [212] 로 막는다', () => {
    const judgement = judgeModeReset('career-batter', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement).toEqual({
      canReset: false, blockReason: 'season-game-in-progress', blockText: MODE_RESET_TEXT.blockedReset,
    })
  })

  it('투수편도 같은 조건으로 막지만 글은 [213] "삭제 하실 수 없습니다" 다 (0x2c950 원본 버그)', () => {
    const judgement = judgeModeReset('career-pitcher', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement.canReset).toBe(false)
    expect(judgement.blockText).toBe(MODE_RESET_TEXT.blockedDelete)
    expect(judgement.blockText).toContain('삭제 하실 수 없습니다')
  })

  it('시즌 경기가 진행 중이어도 그 선수가 시즌 팀에 없으면 막지 않는다', () => {
    const judgement = judgeModeReset('career-batter', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: false,
    })

    expect(judgement).toEqual({ canReset: true, blockReason: null, blockText: null })
  })

  it('선수가 시즌 팀에 있어도 시즌 경기가 진행 중이 아니면 막지 않는다', () => {
    const judgement = judgeModeReset('career-pitcher', {
      isSeasonGameInProgress: false,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement.canReset).toBe(true)
  })

  it('시즌모드·에디트 칸은 막는 조건이 없다 (0x2c7e6 · 0x2c808 곧장 확인)', () => {
    const context = { isSeasonGameInProgress: true, isCareerPlayerInSeasonTeam: true }

    expect(judgeModeReset('season', context).canReset).toBe(true)
    expect(judgeModeReset('edit', context).canReset).toBe(true)
  })

  it('고르기 창 답 0 타자편 · 1 투수편', () => {
    expect(careerResetTargetOf('타자편')).toBe('career-batter')
    expect(careerResetTargetOf('투수편')).toBe('career-pitcher')
  })
})
