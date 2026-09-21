import { describe, expect, it } from 'vitest'
import { judgeModeReset } from '@/entities/settings/model/modeReset'

describe('모드 초기화 판정 (StrMAINMENU 210·211·212)', () => {
  it('나만의리그 타자편 — 시즌 팀에 있고 시즌 경기가 진행 중이면 막는다 (R11 3-1)', () => {
    const judgement = judgeModeReset('career-batter', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement).toEqual({ canReset: false, blockReason: 'season-game-in-progress' })
  })

  it('나만의리그 투수편도 같은 조건으로 막는다', () => {
    const judgement = judgeModeReset('career-pitcher', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement).toEqual({ canReset: false, blockReason: 'season-game-in-progress' })
  })

  it('시즌 경기가 진행 중이어도 그 선수가 시즌 팀에 없으면 막지 않는다', () => {
    const judgement = judgeModeReset('career-batter', {
      isSeasonGameInProgress: true,
      isCareerPlayerInSeasonTeam: false,
    })

    expect(judgement).toEqual({ canReset: true, blockReason: null })
  })

  it('선수가 시즌 팀에 있어도 시즌 경기가 진행 중이 아니면 막지 않는다', () => {
    const judgement = judgeModeReset('career-pitcher', {
      isSeasonGameInProgress: false,
      isCareerPlayerInSeasonTeam: true,
    })

    expect(judgement).toEqual({ canReset: true, blockReason: null })
  })

  it('시즌모드 초기화·에디트 초기화는 막는 조건이 원본에서 확인되지 않아 항상 허용한다', () => {
    const context = { isSeasonGameInProgress: true, isCareerPlayerInSeasonTeam: true }

    expect(judgeModeReset('season', context)).toEqual({ canReset: true, blockReason: null })
    expect(judgeModeReset('edit', context)).toEqual({ canReset: true, blockReason: null })
  })
})
